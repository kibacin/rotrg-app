"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/authFunctions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday, isPast } from "date-fns";

type DaySchedule = {
  date: Date;
  dateStr: string;
  shift: 'first' | 'second' | 'third' | 'off' | null;
  id: number | null;
};

export default function SchedulePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [weekDays, setWeekDays] = useState<DaySchedule[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dayNames = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja"];

  useEffect(() => {
    const fetchUser = async () => {
      const { user } = await getCurrentUser();
      if (user) setUserId(user.id);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchWeekSchedule = async () => {
      if (!userId) return;
      setLoading(true);

      const start = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
      const end = addDays(start, 6);

      const days: DaySchedule[] = [];
      for (let i = 0; i < 7; i++) {
        const date = addDays(start, i);
        days.push({
          date,
          dateStr: format(date, "yyyy-MM-dd"),
          shift: null,
          id: null,
        });
      }

      const { data, error } = await supabase
        .from("work_schedule")
        .select("*")
        .eq("driver_id", userId)
        .gte("work_date", format(start, "yyyy-MM-dd"))
        .lte("work_date", format(end, "yyyy-MM-dd"));

      if (error) {
        console.error("Greška:", error);
      } else if (data) {
        data.forEach((item: any) => {
          const dayIndex = days.findIndex((d) => d.dateStr === item.work_date);
          if (dayIndex !== -1) {
            days[dayIndex].shift = item.shift_type;
            days[dayIndex].id = item.id;
          }
        });
      }

      setWeekDays(days);
      setLoading(false);
    };

    fetchWeekSchedule();
  }, [userId, currentWeekStart]);

  const handleSaveShift = async (index: number, shift: "first" | "second" | "third" | "off") => {
    if (!userId) return;
    const day = weekDays[index];
    setSaving(true);

    try {
      if (day.id) {
        const { error } = await supabase
          .from("work_schedule")
          .update({ shift_type: shift })
          .eq("id", day.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("work_schedule").insert({
          driver_id: userId,
          work_date: day.dateStr,
          shift_type: shift,
        });
        if (error) throw error;
      }

      const updatedDays = [...weekDays];
      updatedDays[index].shift = shift;
      setWeekDays(updatedDays);
    } catch (error: any) {
      alert("Greška: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const goToPreviousWeek = () => setCurrentWeekStart((prev) => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeekStart((prev) => addWeeks(prev, 1));
  const goToCurrentWeek = () => setCurrentWeekStart(new Date());

  const shiftOptions = [
    { value: "first", label: "Prva (06-14h)", bg: "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30" },
    { value: "second", label: "Druga (14-22h)", bg: "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30" },
    { value: "third", label: "Treća (22-06h)", bg: "bg-purple-600/20 text-purple-400 hover:bg-purple-600/30" },
    { value: "off", label: "Slobodan", bg: "bg-slate-600/20 text-slate-400 hover:bg-slate-600/30" },
  ];

  const weekLabel = `${format(currentWeekStart, "dd.MM.")} - ${format(addDays(currentWeekStart, 6), "dd.MM.yyyy.")}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] p-4 text-center text-slate-400">
        <span className="inline-block animate-spin mr-2">⏳</span> Učitavanje rasporeda...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-4 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="text-blue-500" size={28} />
            Raspored
          </h1>
          <p className="text-slate-400 text-sm">Izaberite smenu za svaki dan</p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={goToPreviousWeek} className="border-slate-700 text-slate-400 hover:bg-slate-800">
            <ChevronLeft size={16} />
          </Button>
          <Button variant="outline" size="sm" onClick={goToCurrentWeek} className="border-slate-700 text-slate-400 hover:bg-slate-800">
            Danas
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextWeek} className="border-slate-700 text-slate-400 hover:bg-slate-800">
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <p className="text-slate-500 text-center text-sm">{weekLabel}</p>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((day, index) => {
          const isPastDay = isPast(day.date) && !isToday(day.date);
          const isTodayDay = isToday(day.date);
          const dayOfWeek = day.date.getDay();
          const dayNameIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          const dayName = dayNames[dayNameIndex];

          return (
            <Card
              key={day.dateStr}
              className={`border-0 bg-[#12121a]/90 backdrop-blur-xl ${
                isPastDay ? "opacity-50" : ""
              } ${isTodayDay ? "ring-2 ring-blue-600 shadow-lg shadow-blue-600/20" : ""}`}
            >
              <CardHeader className="py-2 text-center">
                <CardTitle className="text-sm text-white font-medium">{dayName}</CardTitle>
                <p className={`text-xs ${isTodayDay ? "text-blue-500 font-bold" : "text-slate-500"}`}>
                  {format(day.date, "dd.MM.")}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {isPastDay && !day.shift ? (
                  <p className="text-xs text-slate-500 text-center">Prošlo</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1">
                    {shiftOptions.map((option) => {
                      const isSelected = day.shift === option.value;
                      return (
                        <Button
                          key={option.value}
                          size="sm"
                          variant="outline"
                          className={`text-xs p-1 h-auto py-1 transition-all ${
                            isSelected
                              ? option.bg + " border-transparent"
                              : "border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white"
                          }`}
                          onClick={() => handleSaveShift(index, option.value as any)}
                          disabled={isPastDay || saving}
                        >
                          {option.label.split(" ")[0]}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-slate-600 pt-2">
        * Prošli dani su onemogućeni za izmenu
      </p>
    </div>
  );
}