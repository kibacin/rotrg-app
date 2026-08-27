import { supabase } from "./supabaseClient";

export type ScheduleChange =
  | { type: "shift"; value: string | null }
  | { type: "bled"; value: boolean };

export type SavedSchedule = {
  id: number | null;
  shift_type: string | null;
  bled: boolean;
  unchanged?: boolean;
};

type ScheduleChangeResponse = {
  success?: boolean;
  error?: string;
  schedule?: SavedSchedule;
};

export async function saveScheduleChange(
  workDate: string,
  change: ScheduleChange
): Promise<SavedSchedule> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const response = await fetch("/api/schedule", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ workDate, change }),
  });

  const result = await response.json() as ScheduleChangeResponse;
  if (!response.ok || !result.success || !result.schedule) {
    throw new Error(result.error || "The schedule change could not be saved");
  }

  return result.schedule;
}

