import { NextRequest, NextResponse } from "next/server";
import { authenticateActiveUser } from "@/app/lib/serverAuth";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const authentication = await authenticateActiveUser(request);
    if (!authentication.user || !authentication.profile || !authentication.supabaseAdmin) {
      return NextResponse.json({ error: authentication.error }, { status: 401 });
    }

    if (authentication.profile.role === "admin") {
      return NextResponse.json({ error: "Only drivers can submit vehicle photo reports" }, { status: 403 });
    }

    const payload = await request.json();
    const reportId = typeof payload?.reportId === "string" ? payload.reportId : "";
    const paths = Array.isArray(payload?.paths)
      ? Array.from(new Set(payload.paths.filter((path: unknown) => typeof path === "string"))) as string[]
      : [];

    if (!UUID_PATTERN.test(reportId) || paths.length < 6 || paths.length > 8) {
      return NextResponse.json(
        { error: "A vehicle report must contain between 6 and 8 camera photos" },
        { status: 400 }
      );
    }

    const expectedPrefix = `${authentication.user.id}/${reportId}/`;
    if (paths.some((path) => !path.startsWith(expectedPrefix) || path.includes(".."))) {
      return NextResponse.json({ error: "Invalid vehicle photo path" }, { status: 400 });
    }

    const { data: report, error: reportError } = await authentication.supabaseAdmin
      .from("car_reports")
      .select("id, driver_id, status")
      .eq("id", reportId)
      .maybeSingle();

    if (
      reportError
      || !report
      || report.driver_id !== authentication.user.id
      || report.status !== "draft"
    ) {
      return NextResponse.json({ error: "The draft vehicle report was not found" }, { status: 404 });
    }

    const folder = `${authentication.user.id}/${reportId}`;
    const { data: storedFiles, error: listError } = await authentication.supabaseAdmin.storage
      .from("car-photos")
      .list(folder, { limit: 20 });

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 400 });
    }

    const storedNames = new Set((storedFiles ?? []).map((file) => `${folder}/${file.name}`));
    if (paths.some((path) => !storedNames.has(path))) {
      return NextResponse.json(
        { error: "One or more vehicle photos did not finish uploading" },
        { status: 400 }
      );
    }

    const urls = paths.map((path) =>
      authentication.supabaseAdmin!.storage.from("car-photos").getPublicUrl(path).data.publicUrl
    );

    const { data, error } = await authentication.supabaseAdmin.rpc("finalize_car_report", {
      p_report_id: reportId,
      p_driver_id: authentication.user.id,
      p_paths: paths,
      p_urls: urls,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, report: data });
  } catch (error) {
    console.error("Vehicle report finalization failed:", error);
    return NextResponse.json({ error: "The vehicle report could not be saved" }, { status: 500 });
  }
}

