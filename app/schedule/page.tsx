"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/authFunctions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  // Mape za dane na LATINICI
  const dayNames = [
    "Ponedeljak",
    "Utorak",
    "Sreda",
    "Četvrtak",
    "Petak",
    "Subota",
    "Nedelja",
  ];

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
    { value: "first", label: "Prva (06-14h)", bg: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
    { value: "second", label: "Druga (14-22h)", bg: "bg-green-100 text-green-700 hover:bg-green-200" },
    { value: "third", label: "Treća (22-06h)", bg: "bg-purple-100 text-purple-700 hover:bg-purple-200" },
    { value: "off", label: "Slobodan", bg: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
  ];

  const weekLabel = `${format(currentWeekStart, "dd.MM.")} - ${format(addDays(currentWeekStart, 6), "dd.MM.yyyy.")}`;

  if (loading) {
    return <div className="p-4 text-center">⏳ Učitavanje...</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">📅 Raspored</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
            ◀
          </Button>
          <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
            Danas
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextWeek}>
            ▶
          </Button>
        </div>
      </div>
      <p className="text-gray-600 text-center font-medium">{weekLabel}</p>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((day, index) => {
          const isPastDay = isPast(day.date) && !isToday(day.date);
          const isTodayDay = isToday(day.date);
          const dayOfWeek = day.date.getDay(); // 0 = nedelja, 1 = ponedeljak
          const dayNameIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // prilagođavamo
          const dayName = dayNames[dayNameIndex];

          return (
            <Card
              key={day.dateStr}
              className={`${isPastDay ? "opacity-60" : ""} ${
                isTodayDay ? "ring-2 ring-blue-500" : ""
              }`}
            >
              <CardHeader className="py-2 text-center">
                <CardTitle className="text-sm font-medium">{dayName}</CardTitle>
                <p
                  className={`text-xs ${
                    isTodayDay ? "text-blue-600 font-bold" : "text-gray-500"
                  }`}
                >
                  {format(day.date, "dd.MM.")}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {isPastDay && !day.shift ? (
                  <p className="text-xs text-gray-400 text-center">Prošlo</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-1">
                      {shiftOptions.map((option) => {
                        const isSelected = day.shift === option.value;
                        return (
                          <Button
                            key={option.value}
                            size="sm"
                            variant="outline"
                            className={`text-xs p-1 h-auto py-1 ${isSelected ? option.bg : "bg-white"}`}
                            onClick={() => handleSaveShift(index, option.value as any)}
                            disabled={isPastDay || saving}
                          >
                            {option.label}
                          </Button>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 text-center">
        * Prošli dani su onemogućeni za izmenu
      </p>
    </div>
  );
}