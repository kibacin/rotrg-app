import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin } from "@/app/lib/serverAuth";

export const runtime = "nodejs";

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: NextRequest) {
  try {
    const authentication = await authenticateAdmin(request);
    if (!authentication.user || !authentication.supabaseAdmin) {
      return NextResponse.json({ error: authentication.error }, { status: 403 });
    }

    const payload = await request.json();
    const action = payload?.action;

    if (action === "add_car") {
      const name = cleanText(payload?.name, 120);
      const plate = cleanText(payload?.plate, 40).toUpperCase();
      const year = Number(payload?.year);

      if (!name || !plate || !Number.isInteger(year) || year < 1980 || year > 2100) {
        return NextResponse.json({ error: "Enter a valid vehicle name, plate and year" }, { status: 400 });
      }

      const { data: car, error } = await authentication.supabaseAdmin
        .from("cars")
        .insert({ name, plate, year })
        .select("id, name, plate, year")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, car });
    }

    if (action === "add_service_report") {
      const carId = Number(payload?.carId);
      const serviceDate = cleanText(payload?.serviceDate, 10);
      const provider = cleanText(payload?.provider, 160) || null;
      const issueDescription = cleanText(payload?.issueDescription, 4000);
      const workPerformed = cleanText(payload?.workPerformed, 6000);
      const notes = cleanText(payload?.notes, 4000) || null;
      const odometerValue = payload?.odometerKm === "" || payload?.odometerKm == null
        ? null
        : Number(payload.odometerKm);
      const costValue = payload?.costEur === "" || payload?.costEur == null
        ? null
        : Number(payload.costEur);

      if (
        !Number.isSafeInteger(carId)
        || carId <= 0
        || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)
        || !issueDescription
        || !workPerformed
        || (odometerValue !== null && (!Number.isInteger(odometerValue) || odometerValue < 0))
        || (costValue !== null && (!Number.isFinite(costValue) || costValue < 0))
      ) {
        return NextResponse.json({ error: "Complete the required service fields" }, { status: 400 });
      }

      const { data: report, error } = await authentication.supabaseAdmin
        .from("vehicle_service_reports")
        .insert({
          car_id: carId,
          admin_id: authentication.user.id,
          service_date: serviceDate,
          provider,
          odometer_km: odometerValue,
          issue_description: issueDescription,
          work_performed: workPerformed,
          notes,
          cost_eur: costValue,
        })
        .select("id, car_id, admin_id, service_date, provider, odometer_km, issue_description, work_performed, notes, cost_eur, created_at")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, report });
    }

    return NextResponse.json({ error: "Unknown fleet action" }, { status: 400 });
  } catch (error) {
    console.error("Fleet update failed:", error);
    return NextResponse.json({ error: "The fleet update could not be saved" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authentication = await authenticateAdmin(request);
    if (!authentication.user || !authentication.supabaseAdmin) {
      return NextResponse.json({ error: authentication.error }, { status: 403 });
    }

    const payload = await request.json();
    const reportId = typeof payload?.reportId === "string" ? payload.reportId : "";
    if (!reportId) {
      return NextResponse.json({ error: "Choose a service report" }, { status: 400 });
    }

    const { error } = await authentication.supabaseAdmin
      .from("vehicle_service_reports")
      .delete()
      .eq("id", reportId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Service report deletion failed:", error);
    return NextResponse.json({ error: "The service report could not be deleted" }, { status: 500 });
  }
}

