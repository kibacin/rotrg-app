import { NextRequest, NextResponse } from "next/server";
import { authenticateAdmin } from "@/app/lib/serverAuth";
import { getShiftLabel } from "@/app/lib/schedule";
import { sendNotificationToUser } from "@/app/lib/push";

export const runtime = "nodejs";

type AssignmentKind = "shift" | "bled";

function formatWorkDate(workDate: string) {
  return new Date(`${workDate}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export async function POST(request: NextRequest) {
  try {
    const authentication = await authenticateAdmin(request);
    if (!authentication.user || !authentication.supabaseAdmin) {
      return NextResponse.json(
        { error: authentication.error },
        { status: authentication.error === "Niste prijavljeni" ? 401 : 403 }
      );
    }

    const payload = await request.json();
    const scheduleId = Number(payload?.scheduleId);
    const assignmentKind = payload?.assignmentKind as AssignmentKind;
    const carId = payload?.carId === null ? null : Number(payload?.carId);

    if (
      !Number.isSafeInteger(scheduleId) ||
      scheduleId <= 0 ||
      !["shift", "bled"].includes(assignmentKind) ||
      (carId !== null && (!Number.isSafeInteger(carId) || carId <= 0))
    ) {
      return NextResponse.json({ error: "Invalid vehicle assignment" }, { status: 400 });
    }

    const supabaseAdmin = authentication.supabaseAdmin;

    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from("work_schedule")
      .select("id, driver_id, work_date, shift_type, bled, car_id, bled_car_id")
      .eq("id", scheduleId)
      .maybeSingle();

    if (scheduleError || !schedule) {
      return NextResponse.json({ error: "Schedule entry was not found" }, { status: 404 });
    }

    if (carId !== null && assignmentKind === "shift" && !schedule.shift_type) {
      return NextResponse.json(
        { error: "This driver has no regular shift on the selected date" },
        { status: 400 }
      );
    }

    if (carId !== null && assignmentKind === "bled" && !schedule.bled) {
      return NextResponse.json(
        { error: "This driver is not available for Bled on the selected date" },
        { status: 400 }
      );
    }

    const currentCarId = assignmentKind === "bled" ? schedule.bled_car_id : schedule.car_id;
    const unchanged = carId === null
      ? currentCarId === null
      : Number(currentCarId) === carId;
    if (unchanged) {
      return NextResponse.json({ success: true, unchanged: true });
    }

    let car: { id: number; name: string; plate: string } | null = null;
    if (carId !== null) {
      const { data: loadedCar, error: carError } = await supabaseAdmin
        .from("cars")
        .select("id, name, plate")
        .eq("id", carId)
        .maybeSingle();

      if (carError || !loadedCar) {
        return NextResponse.json({ error: "Vehicle was not found" }, { status: 404 });
      }

      car = loadedCar as { id: number; name: string; plate: string };
    }

    const assignmentColumn = assignmentKind === "bled" ? "bled_car_id" : "car_id";
    const { error: updateError } = await supabaseAdmin
      .from("work_schedule")
      .update({ [assignmentColumn]: carId })
      .eq("id", scheduleId);

    if (updateError) {
      return NextResponse.json(
        { error: `Vehicle assignment could not be saved: ${updateError.message}` },
        { status: 500 }
      );
    }

    const dateLabel = formatWorkDate(schedule.work_date);
    const assignmentLabel = assignmentKind === "bled"
      ? "Bled"
      : getShiftLabel(schedule.shift_type, schedule.work_date);
    const title = car
      ? assignmentKind === "bled" ? "Bled vehicle assigned" : "Vehicle assigned"
      : assignmentKind === "bled" ? "Bled vehicle removed" : "Vehicle assignment removed";
    const body = car
      ? `${dateLabel} · ${assignmentLabel}: ${car.name} · ${car.plate}`
      : `${dateLabel} · ${assignmentLabel}: the vehicle assignment was removed.`;

    const { error: inAppError } = await supabaseAdmin
      .from("user_notifications")
      .insert({
        user_id: schedule.driver_id,
        kind: "vehicle_assignment",
        title,
        body,
        url: "/schedule",
        metadata: {
          schedule_id: schedule.id,
          assignment_kind: assignmentKind,
          car_id: carId,
          work_date: schedule.work_date,
        },
      });

    if (inAppError) {
      console.error("Could not save the personal assignment notification:", inAppError);
    }

    let pushResult: { total: number; sent: number; failed: number } | null = null;
    let pushError = false;

    try {
      pushResult = await sendNotificationToUser(
        schedule.driver_id,
        title,
        body,
        "/schedule",
        `vehicle-${assignmentKind}-${schedule.id}`
      );
    } catch (error) {
      pushError = true;
      console.error("Could not send the assignment push notification:", error);
    }

    return NextResponse.json({
      success: true,
      assignment: {
        scheduleId,
        assignmentKind,
        carId,
      },
      notification: {
        inAppSaved: !inAppError,
        push: pushResult,
        pushError,
      },
    });
  } catch (error) {
    console.error("Vehicle assignment failed:", error);
    return NextResponse.json(
      { error: "Vehicle assignment could not be saved" },
      { status: 500 }
    );
  }
}
