import { NextRequest, NextResponse } from "next/server";
import { authenticateActiveUser } from "@/app/lib/serverAuth";
import { sendNotificationToUsers } from "@/app/lib/push";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const authentication = await authenticateActiveUser(request);
    if (!authentication.user || !authentication.profile || !authentication.supabaseAdmin) {
      return NextResponse.json({ error: authentication.error }, { status: 401 });
    }

    const payload = await request.json();
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";
    const requestedMentionIds = Array.isArray(payload?.mentionIds)
      ? Array.from(new Set(payload.mentionIds.filter((id: unknown) => typeof id === "string" && UUID_PATTERN.test(id)))) as string[]
      : [];

    if (!body || body.length > 2000) {
      return NextResponse.json({ error: "Write a message up to 2000 characters" }, { status: 400 });
    }
    if (requestedMentionIds.length > 20) {
      return NextResponse.json({ error: "A message can mention up to 20 people" }, { status: 400 });
    }

    const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
    const { count } = await authentication.supabaseAdmin
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("author_id", authentication.user.id)
      .gte("created_at", tenSecondsAgo);

    if ((count ?? 0) >= 6) {
      return NextResponse.json(
        { error: "You are sending messages too quickly. Wait a few seconds." },
        { status: 429 }
      );
    }

    const { data: activeRecipients, error: recipientsError } = await authentication.supabaseAdmin
      .from("drivers")
      .select("id, chat_notifications_muted")
      .eq("active", true)
      .neq("id", authentication.user.id);
    if (recipientsError) throw recipientsError;

    const activeRecipientIds = new Set((activeRecipients ?? []).map((recipient) => recipient.id));
    const mentionIds = requestedMentionIds.filter((id) => activeRecipientIds.has(id));
    const notificationRecipientIds = new Set(
      (activeRecipients ?? [])
        .filter((recipient) => recipient.chat_notifications_muted !== true)
        .map((recipient) => recipient.id)
    );
    const mentionedNotificationIds = mentionIds.filter((id) => notificationRecipientIds.has(id));
    const mentionedNotificationIdSet = new Set(mentionedNotificationIds);
    const regularNotificationIds = Array.from(notificationRecipientIds)
      .filter((id) => !mentionedNotificationIdSet.has(id));

    const { data: message, error: messageError } = await authentication.supabaseAdmin
      .from("chat_messages")
      .insert({ author_id: authentication.user.id, body })
      .select("id, author_id, body, created_at, deleted_at")
      .single();
    if (messageError || !message) {
      return NextResponse.json({ error: messageError?.message || "The message could not be sent" }, { status: 400 });
    }

    if (mentionIds.length) {
      const { error: mentionRowsError } = await authentication.supabaseAdmin
        .from("chat_mentions")
        .insert(mentionIds.map((mentionedUserId) => ({
          message_id: message.id,
          mentioned_user_id: mentionedUserId,
        })));
      if (mentionRowsError) {
        await authentication.supabaseAdmin.from("chat_messages").delete().eq("id", message.id);
        throw mentionRowsError;
      }
    }

    if (notificationRecipientIds.size) {
      const senderName = authentication.profile.full_name?.trim() || "A team member";
      const mentionTitle = `${senderName} mentioned you`;
      const messageTitle = `New message from ${senderName}`;
      const notificationBody = body.length > 140 ? `${body.slice(0, 137)}...` : body;
      const notificationRows = [
        ...mentionedNotificationIds.map((userId) => ({
          user_id: userId,
          kind: "chat_mention",
          title: mentionTitle,
          body: notificationBody,
          url: "/chat",
          metadata: { message_id: message.id },
        })),
        ...regularNotificationIds.map((userId) => ({
          user_id: userId,
          kind: "chat_message",
          title: messageTitle,
          body: notificationBody,
          url: "/chat",
          metadata: { message_id: message.id },
        })),
      ];

      const { error: notificationError } = await authentication.supabaseAdmin
        .from("user_notifications")
        .insert(notificationRows);
      if (notificationError) {
        console.error("Could not save chat message notifications:", notificationError);
      }

      const pushResults = await Promise.allSettled([
        ...(mentionedNotificationIds.length
          ? [sendNotificationToUsers(
              mentionedNotificationIds,
              mentionTitle,
              notificationBody,
              "/chat",
              `chat-message-${message.id}`
            )]
          : []),
        ...(regularNotificationIds.length
          ? [sendNotificationToUsers(
              regularNotificationIds,
              messageTitle,
              notificationBody,
              "/chat",
              `chat-message-${message.id}`
            )]
          : []),
      ]);
      pushResults.forEach((result) => {
        if (result.status === "rejected") {
          console.error("Could not send chat message push:", result.reason);
        }
      });
    }

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("Chat message failed:", error);
    return NextResponse.json({ error: "The message could not be sent" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authentication = await authenticateActiveUser(request);
    if (!authentication.user || !authentication.profile || !authentication.supabaseAdmin) {
      return NextResponse.json({ error: authentication.error }, { status: 401 });
    }

    const payload = await request.json();
    const messageId = typeof payload?.messageId === "string" ? payload.messageId : "";
    if (!UUID_PATTERN.test(messageId)) {
      return NextResponse.json({ error: "Choose a message" }, { status: 400 });
    }

    const { data: message, error: loadError } = await authentication.supabaseAdmin
      .from("chat_messages")
      .select("id, author_id, deleted_at")
      .eq("id", messageId)
      .maybeSingle();

    if (loadError || !message) {
      return NextResponse.json({ error: "The message was not found" }, { status: 404 });
    }
    if (message.author_id !== authentication.user.id && authentication.profile.role !== "admin") {
      return NextResponse.json({ error: "You cannot remove this message" }, { status: 403 });
    }

    const { error } = await authentication.supabaseAdmin
      .from("chat_messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", messageId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Chat deletion failed:", error);
    return NextResponse.json({ error: "The message could not be removed" }, { status: 500 });
  }
}
