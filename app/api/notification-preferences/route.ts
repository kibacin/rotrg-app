import { NextRequest, NextResponse } from "next/server";
import { authenticateActiveUser } from "@/app/lib/serverAuth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const authentication = await authenticateActiveUser(request);
    if (!authentication.user || !authentication.supabaseAdmin) {
      return NextResponse.json({ error: authentication.error }, { status: 401 });
    }

    const { data, error } = await authentication.supabaseAdmin
      .from("drivers")
      .select("chat_notifications_muted")
      .eq("id", authentication.user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      chatNotificationsMuted: data.chat_notifications_muted === true,
    });
  } catch (error) {
    console.error("Notification preferences could not be loaded:", error);
    return NextResponse.json(
      { error: "Notification preferences could not be loaded" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authentication = await authenticateActiveUser(request);
    if (!authentication.user || !authentication.supabaseAdmin) {
      return NextResponse.json({ error: authentication.error }, { status: 401 });
    }

    const payload = await request.json();
    if (typeof payload?.chatNotificationsMuted !== "boolean") {
      return NextResponse.json(
        { error: "Choose whether group chat notifications should be muted" },
        { status: 400 }
      );
    }

    const { data, error } = await authentication.supabaseAdmin
      .from("drivers")
      .update({ chat_notifications_muted: payload.chatNotificationsMuted })
      .eq("id", authentication.user.id)
      .select("chat_notifications_muted")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      chatNotificationsMuted: data.chat_notifications_muted === true,
    });
  } catch (error) {
    console.error("Notification preferences could not be saved:", error);
    return NextResponse.json(
      { error: "Notification preferences could not be saved" },
      { status: 500 }
    );
  }
}
