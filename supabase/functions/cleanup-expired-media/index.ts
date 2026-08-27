import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const configuredAdminApiKey = Deno.env.get("ROTRG_ADMIN_API_KEY");
const legacyServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");

function getAdminApiKey() {
  if (configuredAdminApiKey) return configuredAdminApiKey;

  if (secretKeysJson) {
    try {
      const secretKeys = JSON.parse(secretKeysJson);
      if (typeof secretKeys?.default === "string" && secretKeys.default) {
        return secretKeys.default;
      }
    } catch {
      // Older projects may not provide the new secret-key dictionary.
    }
  }

  return legacyServiceRoleKey;
}

const adminApiKey = getAdminApiKey();

if (!supabaseUrl || !adminApiKey) {
  throw new Error("Supabase function environment is not configured");
}

const supabase = createClient(supabaseUrl, adminApiKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BATCH_SIZE = 500;

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function carPhotoPath(photoUrl: string | null) {
  if (!photoUrl) return null;
  const marker = "/storage/v1/object/public/car-photos/";
  const markerIndex = photoUrl.indexOf(marker);
  if (markerIndex < 0) return null;

  try {
    return decodeURIComponent(photoUrl.slice(markerIndex + marker.length));
  } catch {
    return photoUrl.slice(markerIndex + marker.length);
  }
}

function isServiceRoleRequest(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return false;

  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return false;

    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - normalized.length % 4) % 4);
    const claims = JSON.parse(atob(normalized + padding));

    // Supabase's Edge gateway verifies the JWT before this handler runs.
    return claims?.role === "service_role";
  } catch {
    return false;
  }
}

async function cleanupVehiclePhotos() {
  let deleted = 0;
  const cutoff = daysAgo(30);

  while (true) {
    const { data: rows, error } = await supabase
      .from("car_photos")
      .select("id, storage_path, photo_url")
      .lt("uploaded_at", cutoff)
      .order("uploaded_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw error;
    if (!rows?.length) break;

    const paths = Array.from(new Set(
      rows
        .map((row) => row.storage_path || carPhotoPath(row.photo_url))
        .filter((path): path is string => Boolean(path))
    ));
    if (paths.length) {
      const { error: removeError } = await supabase.storage.from("car-photos").remove(paths);
      if (removeError) throw removeError;
    }

    const { error: deleteError } = await supabase
      .from("car_photos")
      .delete()
      .in("id", rows.map((row) => row.id));
    if (deleteError) throw deleteError;
    deleted += rows.length;
    if (rows.length < BATCH_SIZE) break;
  }

  const { data: staleDrafts, error: draftError } = await supabase
    .from("car_reports")
    .select("id, driver_id")
    .eq("status", "draft")
    .lt("created_at", daysAgo(1))
    .limit(BATCH_SIZE);
  if (draftError) throw draftError;

  for (const draft of staleDrafts ?? []) {
    const folder = `${draft.driver_id}/${draft.id}`;
    const { data: files, error: listError } = await supabase.storage
      .from("car-photos")
      .list(folder, { limit: 20 });
    if (listError) throw listError;
    const paths = (files ?? []).map((file) => `${folder}/${file.name}`);
    if (paths.length) {
      const { error: removeError } = await supabase.storage.from("car-photos").remove(paths);
      if (removeError) throw removeError;
    }
  }

  if (staleDrafts?.length) {
    const { error: deleteDraftError } = await supabase
      .from("car_reports")
      .delete()
      .in("id", staleDrafts.map((draft) => draft.id));
    if (deleteDraftError) throw deleteDraftError;
  }

  const { error: reportError } = await supabase
    .from("car_reports")
    .delete()
    .eq("status", "submitted")
    .lt("created_at", cutoff);
  if (reportError) throw reportError;

  return { photos: deleted, drafts: staleDrafts?.length ?? 0 };
}

async function cleanupReceipts() {
  let deleted = 0;
  const cutoff = daysAgo(30);

  while (true) {
    const { data: rows, error } = await supabase
      .from("receipts")
      .select("id, storage_path")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw error;
    if (!rows?.length) break;

    const { error: removeError } = await supabase.storage
      .from("receipts")
      .remove(rows.map((row) => row.storage_path));
    if (removeError) throw removeError;

    const { error: deleteError } = await supabase
      .from("receipts")
      .delete()
      .in("id", rows.map((row) => row.id));
    if (deleteError) throw deleteError;
    deleted += rows.length;
    if (rows.length < BATCH_SIZE) break;
  }

  return deleted;
}

async function cleanupAnnouncements() {
  let deleted = 0;

  while (true) {
    const { data: announcements, error } = await supabase
      .from("announcements")
      .select("id")
      .lt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw error;
    if (!announcements?.length) break;

    const ids = announcements.map((announcement) => announcement.id);
    const { data: imageRows, error: imageError } = await supabase
      .from("announcement_images")
      .select("storage_path")
      .in("announcement_id", ids);
    if (imageError) throw imageError;

    const paths = (imageRows ?? []).map((image) => image.storage_path);
    if (paths.length) {
      const { error: removeError } = await supabase.storage
        .from("announcement-images")
        .remove(paths);
      if (removeError) throw removeError;
    }

    const { error: deleteError } = await supabase
      .from("announcements")
      .delete()
      .in("id", ids);
    if (deleteError) throw deleteError;
    deleted += ids.length;
    if (ids.length < BATCH_SIZE) break;
  }

  return deleted;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  if (!isServiceRoleRequest(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const [vehiclePhotos, receipts, announcements] = await Promise.all([
      cleanupVehiclePhotos(),
      cleanupReceipts(),
      cleanupAnnouncements(),
    ]);

    return new Response(JSON.stringify({
      success: true,
      deleted: { vehiclePhotos, receipts, announcements },
      finishedAt: new Date().toISOString(),
    }), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("Expired media cleanup failed", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Cleanup failed",
    }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
