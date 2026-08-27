import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin } from "@/app/lib/serverAuth";
import { sendNotificationToAll } from "@/app/lib/push";

export const runtime = "nodejs";

function safeExtension(file: File) {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: NextRequest) {
  try {
    const authentication = await authenticateAdmin(request);
    if (!authentication.user || !authentication.supabaseAdmin) {
      return NextResponse.json({ error: authentication.error }, { status: 403 });
    }

    const formData = await request.formData();
    const title = String(formData.get("title") || "").trim();
    const content = String(formData.get("content") || "").trim();
    const images = formData
      .getAll("images")
      .filter((item): item is File => item instanceof File && item.size > 0);

    if (!title || !content || title.length > 120 || content.length > 5000) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    }
    if (images.length > 3) {
      return NextResponse.json({ error: "An announcement can contain up to 3 images" }, { status: 400 });
    }
    if (images.some((file) => !file.type.startsWith("image/") || file.size > 8 * 1024 * 1024)) {
      return NextResponse.json({ error: "Each announcement image must be smaller than 8 MB" }, { status: 400 });
    }

    const { data: announcement, error: announcementError } = await authentication.supabaseAdmin
      .from("announcements")
      .insert({
        admin_id: authentication.user.id,
        title,
        content,
      })
      .select("id, admin_id, title, content, created_at, expires_at")
      .single();

    if (announcementError || !announcement) {
      return NextResponse.json(
        { error: announcementError?.message || "The announcement could not be created" },
        { status: 400 }
      );
    }

    const uploadedPaths: string[] = [];
    try {
      for (let index = 0; index < images.length; index += 1) {
        const image = images[index];
        const storagePath = `${authentication.user.id}/${announcement.id}/${crypto.randomUUID()}.${safeExtension(image)}`;
        const { error: uploadError } = await authentication.supabaseAdmin.storage
          .from("announcement-images")
          .upload(storagePath, image, {
            contentType: image.type || "image/jpeg",
            cacheControl: "3600",
            upsert: false,
          });
        if (uploadError) throw uploadError;
        uploadedPaths.push(storagePath);
      }

      if (uploadedPaths.length) {
        const { error: imageRowsError } = await authentication.supabaseAdmin
          .from("announcement_images")
          .insert(uploadedPaths.map((storagePath, index) => ({
            announcement_id: announcement.id,
            storage_path: storagePath,
            sort_order: index,
          })));
        if (imageRowsError) throw imageRowsError;
      }
    } catch (mediaError) {
      if (uploadedPaths.length) {
        await authentication.supabaseAdmin.storage.from("announcement-images").remove(uploadedPaths);
      }
      await authentication.supabaseAdmin.from("announcements").delete().eq("id", announcement.id);
      throw mediaError;
    }

    let push = null;
    try {
      push = await sendNotificationToAll(title, content, "/notifications");
    } catch (pushError) {
      console.error("Announcement push delivery failed:", pushError);
    }

    return NextResponse.json({
      success: true,
      announcement,
      imageCount: uploadedPaths.length,
      push,
    });
  } catch (error) {
    console.error("Announcement creation failed:", error);
    return NextResponse.json({ error: "The announcement could not be published" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authentication = await authenticateAdmin(request);
    if (!authentication.user || !authentication.supabaseAdmin) {
      return NextResponse.json({ error: authentication.error }, { status: 403 });
    }

    const payload = await request.json();
    const announcementId = Number(payload?.announcementId);
    if (!Number.isSafeInteger(announcementId) || announcementId <= 0) {
      return NextResponse.json({ error: "Choose an announcement" }, { status: 400 });
    }

    const { data: imageRows, error: imageError } = await authentication.supabaseAdmin
      .from("announcement_images")
      .select("storage_path")
      .eq("announcement_id", announcementId);
    if (imageError) {
      return NextResponse.json({ error: imageError.message }, { status: 400 });
    }

    const paths = (imageRows ?? []).map((item) => item.storage_path);
    if (paths.length) {
      const { error: removeError } = await authentication.supabaseAdmin.storage
        .from("announcement-images")
        .remove(paths);
      if (removeError) {
        return NextResponse.json({ error: removeError.message }, { status: 400 });
      }
    }

    const { error } = await authentication.supabaseAdmin
      .from("announcements")
      .delete()
      .eq("id", announcementId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Announcement deletion failed:", error);
    return NextResponse.json({ error: "The announcement could not be deleted" }, { status: 500 });
  }
}

