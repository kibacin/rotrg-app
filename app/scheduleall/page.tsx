"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, addWeeks, format, isToday, startOfWeek, subWeeks } from "date-fns";
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/authFunctions";
import { getShiftLabel, getShiftTone } from "../lib/schedule";
import { AppPage, LoadingScreen, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Driver = {
  id: string;
  email: string;
  full_name: string;
  role: string;
};

type Schedule = {
  id: number;
  driver_id: string;
  work_date: string;
  shift_type: string | null;
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ScheduleAllPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());
  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadSchedule = async () => {
      setLoading(true);
      const { user } = await getCurrentUser();
      if (!user) {
        router.replace("/");
        return;
      }

      const { data: profile } = await supabase
        .from("drivers")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        router.replace("/home");
        return;
      }

      const start = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
      const end = addDays(start, 6);
      const [driversResult, schedulesResult] = await Promise.all([
        supabase.from("drivers").select("id, email, full_name, role").neq("role", "admin").order("full_name"),
        supabase
          .from("work_schedule")
          .select("id, driver_id, work_date, shift_type")
          .gte("work_date", format(start, "yyyy-MM-dd"))
          .lte("work_date", format(end, "yyyy-MM-dd")),
      ]);

      if (!active) return;
      setDrivers((driversResult.data ?? []) as Driver[]);
      setSchedules((schedulesResult.data ?? []) as Schedule[]);
      setLoading(false);
    };

    void loadSchedule();
    return () => {
      active = false;
    };
  }, [currentWeekStart, router]);

  const start = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(start, index)),
    [start]
  );

  if (loading) return <LoadingScreen label="Loading the team schedule..." />;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Team planning"
        title="Driver schedule"
        description="Tap a driver to open their full week."
        icon={CalendarRange}
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
        <div>
          <p className="text-sm font-medium text-slate-300">
            {format(start, "MMM d")} – {format(addDays(start, 6), "MMM d, yyyy")}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">{drivers.length} drivers</p>
        </div>
        <Users size={18} className="text-cyan-300/60" />
      </div>

      {drivers.length === 0 ? (
        <Card className="border border-white/8 bg-white/[0.03] py-0">
          <CardContent className="py-14 text-center text-sm text-slate-500">
            No driver accounts were found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {drivers.map((driver) => {
            const expanded = expandedDriverId === driver.id;
            const driverSchedules = schedules.filter((item) => item.driver_id === driver.id);
            const scheduleByDate = new Map(driverSchedules.map((item) => [item.work_date, item.shift_type]));
            const filledDays = driverSchedules.filter((item) => item.shift_type).length;

            return (
              <Card
                key={driver.id}
                className={`border py-0 transition ${
                  expanded ? "border-cyan-300/20 bg-cyan-300/[0.045]" : "border-white/8 bg-white/[0.03]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedDriverId(expanded ? null : driver.id)}
                  className="w-full p-4 text-left sm:p-5"
                  aria-expanded={expanded}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/10 text-sm font-semibold text-cyan-200">
                      {driver.full_name?.charAt(0) || "D"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold text-white">{driver.full_name}</p>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-[11px] text-slate-600">{filledDays}/7 set</span>
                          <ChevronDown
                            size={17}
                            className={`text-slate-500 transition-transform ${expanded ? "rotate-180 text-cyan-300" : ""}`}
                          />
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-7 gap-1">
                        {weekDays.map((day, index) => {
                          const shift = scheduleByDate.get(format(day, "yyyy-MM-dd"));
                          return (
                            <div key={day.toISOString()} className="min-w-0 text-center">
                              <span className={`block text-[9px] ${isToday(day) ? "text-cyan-300" : "text-slate-600"}`}>
                                {DAY_NAMES[index]}
                              </span>
                              <span
                                className={`mx-auto mt-1 block h-1.5 w-full max-w-7 rounded-full ${
                                  shift ? "bg-cyan-300/55" : "bg-white/5"
                                }`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </button>

                {expanded && (
                  <CardContent className="border-t border-white/8 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
                    <p className="mb-3 truncate text-xs text-slate-600">{driver.email}</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {weekDays.map((day, index) => {
                        const shift = scheduleByDate.get(format(day, "yyyy-MM-dd"));
                        return (
                          <div
                            key={day.toISOString()}
                            className="flex items-center justify-between rounded-xl border border-white/7 bg-black/10 px-3 py-2.5"
                          >
                            <div>
                              <p className={`text-xs font-medium ${isToday(day) ? "text-cyan-300" : "text-slate-300"}`}>
                                {DAY_NAMES[index]}
                              </p>
                              <p className="text-[10px] text-slate-600">{format(day, "MMM d")}</p>
                            </div>
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${getShiftTone(shift)}`}>
                              {getShiftLabel(shift)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </AppPage>
  );
}
