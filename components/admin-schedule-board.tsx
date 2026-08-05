"use client";

import { addDays, format, isToday } from "date-fns";
import { CarFront, CheckCircle2, Clock3, LoaderCircle, MapPin, UserRound } from "lucide-react";
import { getShiftBucket, getShiftLabel, type ShiftBucket } from "@/app/lib/schedule";

export type ScheduleDriver = {
  id: string;
  email: string;
  full_name: string;
};

export type ScheduleCar = {
  id: number;
  name: string;
  plate: string;
};

export type AdminScheduleEntry = {
  id: number;
  driver_id: string;
  work_date: string;
  shift_type: string | null;
  car_id: number | null;
  bled: boolean;
};

type AdminScheduleBoardProps = {
  weekStart: Date;
  selectedDayIndex: number;
  onSelectedDayIndexChange: (index: number) => void;
  drivers: ScheduleDriver[];
  cars: ScheduleCar[];
  schedules: AdminScheduleEntry[];
  loading?: boolean;
  savingScheduleId?: number | null;
  onAssignCar: (scheduleId: number, carId: number | null) => void;
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SCHEDULE_GROUPS: Array<{
  value: ShiftBucket | "bled";
  label: string;
  description: string;
  tone: string;
  dot: string;
}> = [
  {
    value: "07:00",
    label: "7:00",
    description: "Morning start",
    tone: "border-sky-300/15 bg-sky-300/[0.045]",
    dot: "bg-sky-300",
  },
  {
    value: "15:30",
    label: "15:30",
    description: "Afternoon start",
    tone: "border-emerald-300/15 bg-emerald-300/[0.045]",
    dot: "bg-emerald-300",
  },
  {
    value: "whole_day",
    label: "Whole day",
    description: "Available all day",
    tone: "border-violet-300/15 bg-violet-300/[0.045]",
    dot: "bg-violet-300",
  },
  {
    value: "other",
    label: "Other",
    description: "Custom working hours",
    tone: "border-amber-300/15 bg-amber-300/[0.045]",
    dot: "bg-amber-300",
  },
  {
    value: "bled",
    label: "Bled",
    description: "Optional Bled availability",
    tone: "border-rose-300/15 bg-rose-300/[0.045]",
    dot: "bg-rose-300",
  },
];

export function AdminScheduleBoard({
  weekStart,
  selectedDayIndex,
  onSelectedDayIndexChange,
  drivers,
  cars,
  schedules,
  loading = false,
  savingScheduleId = null,
  onAssignCar,
}: AdminScheduleBoardProps) {
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const selectedDay = weekDays[selectedDayIndex] ?? weekDays[0];
  const selectedDate = format(selectedDay, "yyyy-MM-dd");
  const selectedSchedules = schedules.filter((schedule) =>
    schedule.work_date === selectedDate && (getShiftBucket(schedule.shift_type) || schedule.bled)
  );
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));

  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {weekDays.map((day, index) => {
          const date = format(day, "yyyy-MM-dd");
          const count = schedules.filter((schedule) =>
            schedule.work_date === date && (getShiftBucket(schedule.shift_type) || schedule.bled)
          ).length;
          const selected = index === selectedDayIndex;

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectedDayIndexChange(index)}
              className={`min-w-[72px] rounded-2xl border px-3 py-2.5 text-center transition ${
                selected
                  ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-200"
                  : "border-white/7 bg-black/10 text-slate-500 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wider">
                {isToday(day) ? "Today" : DAY_NAMES[index]}
              </span>
              <span className="mt-0.5 block text-sm font-semibold">{format(day, "d MMM")}</span>
              <span className="mt-1 block text-[9px] text-slate-600">{count} drivers</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/7 bg-black/10 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">{format(selectedDay, "EEEE, MMMM d")}</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Drivers are grouped by shift and Bled interest.
          </p>
        </div>
        {loading ? (
          <LoaderCircle size={18} className="animate-spin text-cyan-300" />
        ) : (
          <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-slate-500">
            {selectedSchedules.length} drivers
          </span>
        )}
      </div>

      <div className={`grid gap-3 lg:grid-cols-2 2xl:grid-cols-3 ${loading ? "pointer-events-none opacity-55" : ""}`}>
        {SCHEDULE_GROUPS.map((group) => {
          const groupSchedules = selectedSchedules
            .filter((schedule) =>
              group.value === "bled"
                ? schedule.bled
                : getShiftBucket(schedule.shift_type) === group.value
            )
            .sort((first, second) => {
              const firstName = driverById.get(first.driver_id)?.full_name ?? "";
              const secondName = driverById.get(second.driver_id)?.full_name ?? "";
              return firstName.localeCompare(secondName);
            });

          return (
            <section key={group.value} className={`rounded-2xl border p-3.5 ${group.tone}`}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className={`mt-1 size-2 rounded-full ${group.dot}`} />
                  <div>
                    <h3 className="text-sm font-semibold text-white">{group.label}</h3>
                    <p className="text-[10px] text-slate-600">{group.description}</p>
                  </div>
                </div>
                <span className="rounded-full bg-black/15 px-2 py-0.5 text-[10px] text-slate-500">
                  {groupSchedules.length}
                </span>
              </div>

              {groupSchedules.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/8 px-3 py-7 text-center">
                  <UserRound size={19} className="mx-auto mb-2 text-slate-700" />
                  <p className="text-[11px] text-slate-600">No drivers selected this option.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {groupSchedules.map((schedule) => {
                    const driver = driverById.get(schedule.driver_id);
                    const assignedCar = cars.find((car) => car.id === schedule.car_id);
                    const saving = savingScheduleId === schedule.id;
                    const assignmentBusy = savingScheduleId !== null;

                    return (
                      <div key={schedule.id} className="rounded-xl border border-white/7 bg-[#090f18]/65 p-3">
                        <div className="flex items-start gap-2.5">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-[11px] font-semibold text-slate-300">
                            {driver?.full_name?.charAt(0) || "D"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-white">
                              {driver?.full_name || "Unknown driver"}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1 text-[9px] text-slate-600">
                              {group.value === "bled" ? (
                                <MapPin size={10} />
                              ) : group.value === "other" ? (
                                <Clock3 size={10} />
                              ) : (
                                <CheckCircle2 size={10} />
                              )}
                              {group.value === "bled" ? "Available for Bled" : getShiftLabel(schedule.shift_type)}
                            </div>
                          </div>
                        </div>

                        {group.value !== "bled" && (
                          <>
                            <label className="mt-2.5 block">
                              <span className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                                <CarFront size={10} /> Assigned vehicle
                              </span>
                              <select
                                value={schedule.car_id ?? ""}
                                disabled={assignmentBusy}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  onAssignCar(schedule.id, value ? Number(value) : null);
                                }}
                                className="h-9 w-full rounded-xl border border-white/10 bg-[#0c1420] px-2.5 text-[11px] text-slate-300 outline-none transition focus:border-cyan-300/30 disabled:cursor-wait disabled:opacity-50"
                              >
                                <option value="">No vehicle assigned</option>
                                {cars.map((car) => (
                                  <option key={car.id} value={car.id}>
                                    {car.name} · {car.plate}
                                  </option>
                                ))}
                              </select>
                            </label>

                            {saving && <p className="mt-1 text-[9px] text-cyan-300">Saving assignment...</p>}
                            {!saving && assignedCar && (
                              <p className="mt-1 truncate text-[9px] text-emerald-300/70">
                                Assigned: {assignedCar.name} · {assignedCar.plate}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
