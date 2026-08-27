"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, addWeeks, format, isToday, startOfWeek, subWeeks } from "date-fns";
import { CalendarDays, CarFront, ChevronLeft, ChevronRight, Clock3, MapPin, RotateCcw, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/authFunctions";
import {
  encodeCustomShift,
  getShiftBucket,
  getShiftChoices,
  getShiftLabel,
  getShiftTone,
  parseCustomShift,
  type ShiftChoice,
} from "../lib/schedule";
import { AppPage, LoadingScreen, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveScheduleChange } from "../lib/scheduleChange";
import { getScheduleLockState } from "../lib/scheduleLock";

type DaySchedule = {
  date: Date;
  dateStr: string;
  shift: string | null;
  id: number | null;
  car: { name: string; plate: string } | null;
  bledCar: { name: string; plate: string } | null;
  bled: boolean;
};

type ScheduleRow = {
  id: number;
  work_date: string;
  shift_type: string | null;
  car_id: number | null;
  bled_car_id: number | null;
  bled: boolean;
  shift_car: { name: string; plate: string } | Array<{ name: string; plate: string }> | null;
  bled_car: { name: string; plate: string } | Array<{ name: string; plate: string }> | null;
};

type CustomEditor = {
  index: number;
  start: string;
  end: string;
};

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function SchedulePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [weekDays, setWeekDays] = useState<DaySchedule[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [customEditor, setCustomEditor] = useState<CustomEditor | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(new Date()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let active = true;

    const checkAccess = async () => {
      const { user } = await getCurrentUser();
      if (!user) {
        router.replace("/");
        return;
      }

      const { data } = await supabase
        .from("drivers")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!active) return;
      if (data?.role === "admin") {
        router.replace("/scheduleall");
        return;
      }

      setUserId(user.id);
    };

    void checkAccess();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    const fetchWeekSchedule = async () => {
      setLoading(true);
      const start = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
      const end = addDays(start, 6);
      const days: DaySchedule[] = Array.from({ length: 7 }, (_, index) => {
        const date = addDays(start, index);
        return {
          date,
          dateStr: format(date, "yyyy-MM-dd"),
          shift: null,
          id: null,
          car: null,
          bledCar: null,
          bled: false,
        };
      });

      const { data, error } = await supabase
        .from("work_schedule")
        .select(`
          id,
          work_date,
          shift_type,
          car_id,
          bled_car_id,
          bled,
          shift_car:cars!work_schedule_car_id_fkey(name, plate),
          bled_car:cars!work_schedule_bled_car_id_fkey(name, plate)
        `)
        .eq("driver_id", userId)
        .gte("work_date", format(start, "yyyy-MM-dd"))
        .lte("work_date", format(end, "yyyy-MM-dd"));

      if (error) {
        console.error("Could not load the schedule:", error);
      } else {
        for (const item of (data ?? []) as unknown as ScheduleRow[]) {
          const day = days.find((entry) => entry.dateStr === item.work_date);
          if (day) {
            day.shift = item.shift_type;
            day.id = item.id;
            day.car = Array.isArray(item.shift_car)
              ? item.shift_car[0] ?? null
              : item.shift_car;
            day.bledCar = Array.isArray(item.bled_car)
              ? item.bled_car[0] ?? null
              : item.bled_car;
            day.bled = item.bled;
          }
        }
      }

      if (active) {
        setWeekDays(days);
        setLoading(false);
      }
    };

    void fetchWeekSchedule();
    return () => {
      active = false;
    };
  }, [currentWeekStart, userId]);

  const saveShift = async (index: number, shift: string) => {
    if (!userId) return;
    const day = weekDays[index];
    if (!day) return;

    setSavingIndex(index);
    try {
      const saved = await saveScheduleChange(day.dateStr, { type: "shift", value: shift });

      setWeekDays((current) =>
        current.map((entry, entryIndex) =>
          entryIndex === index
            ? {
                ...entry,
                shift: saved.shift_type,
                id: saved.id,
                bled: saved.bled,
                car: saved.shift_type ? entry.car : null,
              }
            : entry
        )
      );
      setCustomEditor(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The shift could not be saved";
      alert(`Error: ${message}`);
    } finally {
      setSavingIndex(null);
    }
  };

  const removeShift = async (index: number) => {
    const day = weekDays[index];
    if (!day?.id) return;

    setSavingIndex(index);
    try {
      const saved = await saveScheduleChange(day.dateStr, { type: "shift", value: null });

      setWeekDays((current) =>
        current.map((entry, entryIndex) =>
          entryIndex === index
            ? {
                ...entry,
                id: saved.id,
                shift: saved.shift_type,
                bled: saved.bled,
                car: null,
              }
            : entry
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "The availability could not be removed";
      alert(`Error: ${message}`);
    } finally {
      setSavingIndex(null);
    }
  };

  const setBledAvailability = async (index: number, bled: boolean) => {
    if (!userId) return;
    const day = weekDays[index];
    if (!day || day.bled === bled) return;

    setSavingIndex(index);
    try {
      const saved = await saveScheduleChange(day.dateStr, { type: "bled", value: bled });

      setWeekDays((current) =>
        current.map((entry, entryIndex) =>
          entryIndex === index
            ? {
              ...entry,
                id: saved.id,
                shift: saved.shift_type,
                bled: saved.bled,
                bledCar: saved.bled ? entry.bledCar : null,
              }
            : entry
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bled availability could not be saved";
      alert(`Error: ${message}`);
    } finally {
      setSavingIndex(null);
    }
  };

  const selectShift = (index: number, choice: ShiftChoice) => {
    if (getShiftBucket(weekDays[index]?.shift) === choice) {
      void removeShift(index);
      return;
    }

    if (choice !== "other") {
      void saveShift(index, choice);
      return;
    }

    const existing = parseCustomShift(weekDays[index]?.shift);
    setCustomEditor({
      index,
      start: existing?.start ?? "09:00",
      end: existing?.end ?? "17:00",
    });
  };

  const saveCustomShift = () => {
    if (!customEditor) return;
    if (!customEditor.start || !customEditor.end || customEditor.start === customEditor.end) {
      alert("Choose two different start and end times.");
      return;
    }

    void saveShift(customEditor.index, encodeCustomShift(customEditor.start, customEditor.end));
  };

  const start = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekLabel = `${format(start, "MMM d")} – ${format(addDays(start, 6), "MMM d, yyyy")}`;

  if (loading) return <LoadingScreen label="Loading your schedule..." />;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Availability"
        title="My schedule"
        description="Choose your shift and Bled availability for each day."
        icon={CalendarDays}
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setCurrentWeekStart((date) => subWeeks(date, 1))}
              aria-label="Previous week"
              className="rounded-xl border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-white"
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentWeekStart(new Date())}
              className="h-8 rounded-xl border-white/10 bg-white/[0.03] px-3 text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white"
            >
              Today
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setCurrentWeekStart((date) => addWeeks(date, 1))}
              aria-label="Next week"
              className="rounded-xl border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-white"
            >
              <ChevronRight />
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
        <p className="text-sm font-medium text-slate-300">{weekLabel}</p>
        <span className="text-[11px] uppercase tracking-[0.16em] text-slate-600">7 days</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {weekDays.map((day, index) => {
          const isTodayDay = isToday(day.date);
          const lockState = getScheduleLockState(day.dateStr, currentTime);
          const isLocked = lockState.locked;
          const isPastDay = lockState.reason === "past";
          const selectedLabel = getShiftLabel(day.shift, day.dateStr);
          const shiftChoices = getShiftChoices(day.dateStr);

          return (
            <Card
              key={day.dateStr}
              className={`border py-0 transition ${
                isTodayDay
                  ? "border-cyan-300/25 bg-cyan-300/[0.055] shadow-[0_16px_45px_rgba(34,211,238,0.07)]"
                  : "border-white/8 bg-white/[0.03]"
              } ${isPastDay ? "opacity-50" : ""}`}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">{DAY_NAMES[index]}</p>
                      {isTodayDay && (
                        <span className="rounded-full bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                          Today
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{format(day.date, "EEEE, MMMM d")}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getShiftTone(day.shift)}`}>
                    {savingIndex === index ? "Saving..." : selectedLabel}
                  </span>
                </div>

                {day.car && (
                  <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-2.5">
                    <CarFront size={17} className="shrink-0 text-emerald-300" />
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-300/65">
                        Assigned vehicle
                      </p>
                      <p className="truncate text-xs font-semibold text-white">
                        {day.car.name} · {day.car.plate}
                      </p>
                    </div>
                  </div>
                )}

                {isLocked ? (
                  <p className="rounded-xl border border-white/5 bg-black/10 px-3 py-2 text-center text-xs text-slate-600">
                    {lockState.message}
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {shiftChoices.map((choice) => {
                        const selected = getShiftBucket(day.shift) === choice.value;

                        return (
                          <button
                            key={choice.value}
                            type="button"
                            disabled={savingIndex !== null}
                            onClick={() => selectShift(index, choice.value)}
                            className={`rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-wait disabled:opacity-50 ${
                              selected
                                ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200"
                                : "border-white/8 bg-black/10 text-slate-400 hover:border-white/15 hover:bg-white/[0.04] hover:text-white"
                            }`}
                          >
                            <span className="block text-xs font-semibold">{choice.label}</span>
                            <span className="mt-0.5 block text-[10px] text-slate-600">
                              {selected ? "Tap again to remove" : choice.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {day.shift?.startsWith("other|") && (
                      <button
                        type="button"
                        disabled={savingIndex !== null}
                        onClick={() => {
                          const custom = parseCustomShift(day.shift);
                          setCustomEditor({
                            index,
                            start: custom?.start ?? "09:00",
                            end: custom?.end ?? "17:00",
                          });
                        }}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-3 py-2 text-[10px] font-medium text-amber-300 hover:bg-amber-300/10"
                      >
                        <RotateCcw size={13} /> Change custom hours
                      </button>
                    )}
                    {lockState.isTomorrow && (
                      <p className="mt-2 rounded-xl border border-amber-300/12 bg-amber-300/[0.045] px-3 py-2 text-center text-[10px] text-amber-200/80">
                        Tomorrow closes today at 16:30 (Ljubljana time).
                      </p>
                    )}
                  </>
                )}

                <div className="mt-3 space-y-2">
                  {day.bledCar && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] px-3 py-2.5">
                      <CarFront size={17} className="shrink-0 text-rose-300" />
                      <div className="min-w-0">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-rose-300/70">
                          Bled vehicle
                        </p>
                        <p className="truncate text-xs font-semibold text-white">
                          {day.bledCar.name} · {day.bledCar.plate}
                        </p>
                      </div>
                    </div>
                  )}

                  <div
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition ${
                      day.bled
                        ? "border-rose-300/20 bg-rose-300/[0.07]"
                        : "border-white/8 bg-black/10"
                    } ${isLocked ? "opacity-60" : ""}`}
                  >
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                        day.bled ? "bg-rose-300/10 text-rose-300" : "bg-white/5 text-slate-600"
                      }`}
                    >
                      <MapPin size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white">Bled</p>
                      <p className="mt-0.5 text-[10px] text-slate-600">
                        Include me as an option for Bled.
                      </p>
                    </div>
                    <div className="flex shrink-0 rounded-xl border border-white/8 bg-[#0a111b] p-1">
                      {([false, true] as const).map((value) => (
                        <button
                          key={String(value)}
                          type="button"
                          disabled={isLocked || savingIndex !== null}
                          onClick={() => void setBledAvailability(index, value)}
                          className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold transition disabled:cursor-not-allowed ${
                            day.bled === value
                              ? value
                                ? "bg-rose-300 text-slate-950"
                                : "bg-white/10 text-white"
                              : "text-slate-600 hover:text-slate-300"
                          }`}
                        >
                          {value ? "Yes" : "No"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {customEditor && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
          onClick={() => setCustomEditor(null)}
        >
          <Card
            className="w-full max-w-md border border-white/10 bg-[#0d1521] py-0 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <CardContent className="p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300">
                    <Clock3 size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Custom working hours</p>
                    <p className="text-xs text-slate-500">{DAY_NAMES[customEditor.index]}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setCustomEditor(null)}
                  aria-label="Close"
                  className="rounded-xl text-slate-500 hover:bg-white/5 hover:text-white"
                >
                  <X />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="custom-start" className="text-xs text-slate-400">From</Label>
                  <Input
                    id="custom-start"
                    type="time"
                    value={customEditor.start}
                    onChange={(event) => setCustomEditor((current) => current ? { ...current, start: event.target.value } : current)}
                    className="h-11 rounded-xl border-white/10 bg-white/[0.04] text-white focus-visible:border-cyan-300/30 focus-visible:ring-cyan-300/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-end" className="text-xs text-slate-400">To</Label>
                  <Input
                    id="custom-end"
                    type="time"
                    value={customEditor.end}
                    onChange={(event) => setCustomEditor((current) => current ? { ...current, end: event.target.value } : current)}
                    className="h-11 rounded-xl border-white/10 bg-white/[0.04] text-white focus-visible:border-cyan-300/30 focus-visible:ring-cyan-300/10"
                  />
                </div>
              </div>

              <Button
                type="button"
                onClick={saveCustomShift}
                disabled={savingIndex !== null}
                className="mt-5 h-11 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 font-semibold text-slate-950 hover:from-cyan-300 hover:to-blue-400"
              >
                {savingIndex !== null ? "Saving..." : "Save custom hours"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </AppPage>
  );
}
