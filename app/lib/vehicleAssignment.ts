import { supabase } from "./supabaseClient";

export type AssignmentKind = "shift" | "bled";

type AssignmentResponse = {
  success?: boolean;
  error?: string;
  notification?: {
    inAppSaved: boolean;
    push: { total: number; sent: number; failed: number } | null;
    pushError: boolean;
  };
};

export async function saveVehicleAssignment(
  scheduleId: number,
  carId: number | null,
  assignmentKind: AssignmentKind
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const response = await fetch("/api/assign-vehicle", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ scheduleId, carId, assignmentKind }),
  });

  const result = await response.json() as AssignmentResponse;
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Vehicle assignment could not be saved");
  }

  return result;
}
