"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, addWeeks, format, startOfWeek, subWeeks } from "date-fns";
import { CalendarRange, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/authFunctions";
import { AppPage, LoadingScreen, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  AdminScheduleBoard,
  type AdminScheduleEntry,
  type ScheduleCar,
  type ScheduleDriver,
} from "@/components/admin-schedule-board";

export default function ScheduleAllPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<ScheduleDriver[]>([]);
  const [cars, setCars] = useState<ScheduleCar[]>([]);
  const [schedules, setSchedules] = useState<AdminScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => (new Date().getDay() + 6) % 7);
  const [savingScheduleId, setSavingScheduleId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    const loadBaseData = async () => {
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

      const [driversResult, carsResult] = await Promise.all([
        supabase
          .from("drivers")
          .select("id, email, full_name")
          .neq("role", "admin")
          .order("full_name"),
        supabase.from("cars").select("id, name, plate").order("name"),
      ]);

      if (!active) return;
      setDrivers((driversResult.data ?? []) as ScheduleDriver[]);
      setCars((carsResult.data ?? []) as ScheduleCar[]);
      setAuthorized(true);
      setLoading(false);
    };

    void loadBaseData();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    let active = true;

    const loadSchedule = async () => {
      setScheduleLoading(true);
      const start = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
      const end = addDays(start, 6);
      const { data, error } = await supabase
        .from("work_schedule")
        .select("id, driver_id, work_date, shift_type, car_id, bled")
        .gte("work_date", format(start, "yyyy-MM-dd"))
        .lte("work_date", format(end, "yyyy-MM-dd"));

      if (error) console.error("Could not load the team schedule:", error);
      if (active) {
        setSchedules((data ?? []) as AdminScheduleEntry[]);
        setScheduleLoading(false);
      }
    };

    void loadSchedule();
    return () => {
      active = false;
    };
  }, [authorized, currentWeekStart]);

  const assignCar = async (scheduleId: number, carId: number | null) => {
    setSavingScheduleId(scheduleId);
    const previousSchedules = schedules;
    setSchedules((current) =>
      current.map((schedule) => schedule.id === scheduleId ? { ...schedule, car_id: carId } : schedule)
    );

    const { error } = await supabase
      .from("work_schedule")
      .update({ car_id: carId })
      .eq("id", scheduleId);

    if (error) {
      setSchedules(previousSchedules);
      alert(`Vehicle assignment could not be saved: ${error.message}`);
    }
    setSavingScheduleId(null);
  };

  const start = startOfWeek(currentWeekStart, { weekStartsOn: 1 });

  if (loading) return <LoadingScreen label="Loading the team schedule..." />;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Team planning"
        title="Driver schedule"
        description="Review each shift, Bled interest and vehicle assignment."
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
              onClick={() => {
                setCurrentWeekStart(new Date());
                setSelectedDayIndex((new Date().getDay() + 6) % 7);
              }}
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

      <AdminScheduleBoard
        weekStart={start}
        selectedDayIndex={selectedDayIndex}
        onSelectedDayIndexChange={setSelectedDayIndex}
        drivers={drivers}
        cars={cars}
        schedules={schedules}
        loading={scheduleLoading}
        savingScheduleId={savingScheduleId}
        onAssignCar={(scheduleId, carId) => void assignCar(scheduleId, carId)}
      />
    </AppPage>
  );
}
