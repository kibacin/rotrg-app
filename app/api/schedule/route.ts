import { NextRequest, NextResponse } from "next/server";
import { authenticateActiveUser } from "@/app/lib/serverAuth";
import { sendNotificationToUsers } from "@/app/lib/push";

export const runtime = "nodejs";

type ScheduleResult = {
  schedule?: {
    id: number | null;
    shift_type: string | null;
    bled: boolean;
    unchanged?: boolean;
  };
  notification?: {
    title: string;
    body: string;
    admin_ids: string[];
    activity_id: string;
  } | null;
};

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validShift(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  return ["07:00", "15:30", "whole_day"].includes(value)
    || /^other\|([01]\d|2[0-3]):[0-5]\d\|([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const authentication = await authenticateActiveUser(request);
    if (!authentication.user || !authentication.profile || !authentication.supabaseAdmin) {
      return NextResponse.json({ error: authentication.error }, { status: 401 });
    }

    if (authentication.profile.role === "admin") {
      return NextResponse.json(
        { error: "Administrators cannot submit driver availability" },
        { status: 403 }
      );
    }

    const payload = await request.json();
    const workDate = payload?.workDate;
    const change = payload?.change;

    if (!validDate(workDate) || !change || !["shift", "bled"].includes(change.type)) {
      return NextResponse.json({ error: "Invalid schedule change" }, { status: 400 });
    }

    const shiftValue = change.type === "shift" ? change.value : null;
    const bledValue = change.type === "bled" ? change.value : null;

    if (
      (change.type === "shift" && !validShift(shiftValue))
      || (change.type === "bled" && typeof bledValue !== "boolean")
    ) {
      return NextResponse.json({ error: "Invalid schedule value" }, { status: 400 });
    }

    const { data, error } = await authentication.supabaseAdmin.rpc(
      "apply_driver_schedule_change",
      {
        p_driver_id: authentication.user.id,
        p_work_date: workDate,
        p_change_type: change.type,
        p_shift_type: shiftValue,
        p_bled: bledValue,
      }
    );

    if (error) {
      const locked = error.message.includes("SCHEDULE_LOCKED");
      return NextResponse.json(
        {
          error: locked
            ? error.message.replace(/^.*SCHEDULE_LOCKED:\s*/, "")
            : `The schedule change could not be saved: ${error.message}`,
        },
        { status: locked ? 409 : 400 }
      );
    }

    const result = (data ?? {}) as ScheduleResult;
    let push = null;
    if (result.notification?.admin_ids?.length) {
      try {
        push = await sendNotificationToUsers(
          result.notification.admin_ids,
          result.notification.title,
          result.notification.body,
          "/notifications",
          `schedule-${result.notification.activity_id}`
        );
      } catch (pushError) {
        console.error("Could not send schedule push notification:", pushError);
      }
    }

    return NextResponse.json({
      success: true,
      schedule: result.schedule,
      notification: result.notification ? { saved: true, push } : null,
    });
  } catch (error) {
    console.error("Schedule change failed:", error);
    return NextResponse.json(
      { error: "The schedule change could not be saved" },
      { status: 500 }
    );
  }
}

