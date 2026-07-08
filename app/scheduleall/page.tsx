"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/authFunctions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday } from "date-fns";

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
  shift_type: 'first' | 'second' | 'third' | 'off' | null;
};

export default function ScheduleAllPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date());

  useEffect(() => {
    const checkAccess = async () => {
      const { user } = await getCurrentUser();
      if (!user) {
        router.push("/");
        return;
      }

      const { data } = await supabase
        .from("drivers")
        .select("role")
        .eq("id", user.id)
        .single();

      if (data?.role !== "admin") {
        router.push("/home");
        return;
      }

      fetchData();
    };

    checkAccess();
  }, [currentWeekStart]);

  const fetchData = async () => {
    setLoading(true);

    // 1. Učitaj sve vozače
    const { data: driversData } = await supabase
      .from("drivers")
      .select("*")
      .order("full_name");

    if (driversData) setDrivers(driversData);

    // 2. Učitaj raspored za tekuću sedmicu
    const start = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const end = addDays(start, 6);

    const { data: schedulesData } = await supabase
      .from("work_schedule")
      .select("*")
      .gte("work_date", format(start, "yyyy-MM-dd"))
      .lte("work_date", format(end, "yyyy-MM-dd"));

    if (schedulesData) setSchedules(schedulesData);

    setLoading(false);
  };

  const goToPreviousWeek = () => setCurrentWeekStart((prev) => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeekStart((prev) => addWeeks(prev, 1));
  const goToCurrentWeek = () => setCurrentWeekStart(new Date());

  const shiftLabels: Record<string, string> = {
    first: "🕐 Prva",
    second: "🕑 Druga",
    third: "🕒 Treća",
    off: "📴 Slobodan",
  };

  const shiftColors: Record<string, string> = {
    first: "bg-blue-600/20 text-blue-400",
    second: "bg-emerald-600/20 text-emerald-400",
    third: "bg-purple-600/20 text-purple-400",
    off: "bg-slate-600/20 text-slate-400",
  };

  const dayNames = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] p-4 text-center text-slate-400">
        <span className="inline-block animate-spin mr-2">⏳</span> Učitavanje rasporeda...
      </div>
    );
  }

  const start = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-4 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">📅 Raspored svih vozača</h1>
          <p className="text-slate-400 text-sm">
            {format(start, "dd.MM.")} - {format(addDays(start, 6), "dd.MM.yyyy.")}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={goToPreviousWeek} className="border-slate-700 text-slate-400 hover:bg-slate-800">
            ◀
          </Button>
          <Button variant="outline" size="sm" onClick={goToCurrentWeek} className="border-slate-700 text-slate-400 hover:bg-slate-800">
            Danas
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextWeek} className="border-slate-700 text-slate-400 hover:bg-slate-800">
            ▶
          </Button>
        </div>
      </div>

      <Card className="border-0 bg-[#12121a]/90 backdrop-blur-xl">
        <CardContent className="overflow-x-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-2 text-slate-400 font-medium min-w-[120px]">Vozač</th>
                {weekDays.map((day, index) => (
                  <th key={index} className="text-center py-2 px-2 text-slate-400 font-medium min-w-[60px]">
                    <div className="flex flex-col items-center">
                      <span>{dayNames[index]}</span>
                      <span className={`text-xs ${isToday(day) ? "text-blue-500 font-bold" : "text-slate-500"}`}>
                        {format(day, "dd.MM.")}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => {
                const driverSchedules = schedules.filter(s => s.driver_id === driver.id);
                
                return (
                  <tr key={driver.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-2 text-white font-medium">
                      <div>
                        <p>{driver.full_name}</p>
                        <p className="text-xs text-slate-500">{driver.email}</p>
                      </div>
                    </td>
                    {weekDays.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const schedule = driverSchedules.find(s => s.work_date === dateStr);
                      const shift = schedule?.shift_type || null;
                      
                      return (
                        <td key={dateStr} className="text-center py-2 px-1">
                          {shift ? (
                            <span className={`text-xs px-2 py-1 rounded-full ${shiftColors[shift]}`}>
                              {shiftLabels[shift]}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-600">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}