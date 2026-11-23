import { supabase } from "./supabaseClient";

type PhotoId = string | number;
type PhotoKey = { id: PhotoId; car_id: number };
export type CarPhoto = PhotoKey & {
  driver_id: string;
  photo_url: string;
  report_id: string | null;
  uploaded_at: string;
  cars: { name: string; plate: string } | null;
  drivers: { full_name: string; email: string } | null;
};

export function createPhotoWindow() {
  const end = Date.now();
  return {
    from: new Date(end - 30 * 24 * 60 * 60 * 1000).toISOString(),
    through: new Date(end).toISOString(),
  };
}

type PhotoWindow = ReturnType<typeof createPhotoWindow>;

// Use the primary key as a cursor, not an offset: cleanup can delete rows
// while paging. Stop on an empty page, even when the server caps page sizes.
async function visitPhotoPages<T extends PhotoKey>(
  window: PhotoWindow,
  signal: AbortSignal,
  columns: string,
  carId: number | null,
  visit: (rows: T[]) => void,
) {
  let before: PhotoId | null = null;
  while (!signal.aborted) {
    let query = supabase.from("car_photos").select(columns)
      .gte("uploaded_at", window.from).lte("uploaded_at", window.through)
      .order("id", { ascending: false }).limit(carId === null ? 500 : 200);
    if (carId !== null) query = query.eq("car_id", carId);
    if (before !== null) query = query.lt("id", before);
    const { data, error } = await query.abortSignal(signal);
    if (signal.aborted) return;
    if (error) throw error;
    const rows = (data ?? []) as unknown as T[];
    if (!rows.length) return;
    const next = rows[rows.length - 1].id;
    if (next == null || next === before) throw new Error("Photo history cursor did not advance");
    visit(rows);
    before = next;
  }
}

export async function fetchPhotoCounts(window: PhotoWindow, signal: AbortSignal) {
  const byCar = new Map<number, number>();
  let total = 0;
  await visitPhotoPages<PhotoKey>(window, signal, "id,car_id", null, (rows) => {
    total += rows.length;
    for (const row of rows) byCar.set(row.car_id, (byCar.get(row.car_id) ?? 0) + 1);
  });
  return { byCar, total };
}

export async function fetchCarPhotos(carId: number, window: PhotoWindow, signal: AbortSignal) {
  const result: CarPhoto[] = [];
  await visitPhotoPages<CarPhoto>(window, signal,
    "id,car_id,driver_id,photo_url,report_id,uploaded_at,cars(name,plate),drivers(full_name,email)",
    carId, (rows) => result.push(...rows));
  // ID order is for pagination, not necessarily the date on a legacy report.
  return result.sort((a, b) => Date.parse(b.uploaded_at) - Date.parse(a.uploaded_at));
}
