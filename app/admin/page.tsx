"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/authFunctions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday } from "date-fns";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type Driver = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
};

type Schedule = {
  id: number;
  driver_id: string;
  work_date: string;
  shift_type: 'first' | 'second' | 'third' | 'off' | null;
};

type CarPhoto = {
  id: number;
  car_id: number;
  driver_id: string;
  photo_url: string;
  uploaded_at: string;
  cars: {
    name: string;
    plate: string;
  };
  drivers: {
    full_name: string;
    email: string;
  };
};

type PhotoGroup = {
  id: string;
  driver_id: string;
  driver_name: string;
  driver_email: string;
  car_id: number;
  car_name: string;
  car_plate: string;
  uploaded_at: string;
  photos: CarPhoto[];
};

export default function AdminPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [photos, setPhotos] = useState<CarPhoto[]>([]);
  const [photoGroups, setPhotoGroups] = useState<PhotoGroup[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date());
  const [selectedGroup, setSelectedGroup] = useState<PhotoGroup | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const checkAdmin = async () => {
      const { user } = await getCurrentUser();
      if (!user) {
        router.push("/");
        return;
      }

      const { data, error } = await supabase
        .from("drivers")
        .select("role")
        .eq("id", user.id)
        .single();

      if (error || data?.role !== "admin") {
        router.push("/home");
        return;
      }

      setIsAdmin(true);
      fetchData();
    };

    checkAdmin();
  }, [currentWeekStart]);

  const fetchData = async () => {
    setLoading(true);

    // 1. Vozači
    const { data: driversData } = await supabase
      .from("drivers")
      .select("*")
      .order("full_name");

    if (driversData) setDrivers(driversData);

    // 2. Slike
    const { data: photosData } = await supabase
      .from("car_photos")
      .select(`
        *,
        cars (name, plate),
        drivers (full_name, email)
      `)
      .order("uploaded_at", { ascending: false });

    if (photosData) setPhotos(photosData);

    // Grupisanje slika
    const groups = groupPhotos(photosData || []);
    setPhotoGroups(groups);

    // 3. Raspored
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

  // ⭐ GRUPISANJE SLIKA ⭐
  const groupPhotos = (photos: CarPhoto[]): PhotoGroup[] => {
    const groups: { [key: string]: PhotoGroup } = {};

    photos.forEach((photo) => {
      // Koristimo driver_id + car_id + datum (yyyy-MM-dd) kao ključ za grupisanje
      const dateKey = format(new Date(photo.uploaded_at), "yyyy-MM-dd");
      const key = `${photo.driver_id}-${photo.car_id}-${dateKey}`;

      if (!groups[key]) {
        groups[key] = {
          id: key,
          driver_id: photo.driver_id,
          driver_name: photo.drivers?.full_name || "Nepoznat",
          driver_email: photo.drivers?.email || "Nepoznat",
          car_id: photo.car_id,
          car_name: photo.cars?.name || "Nepoznat auto",
          car_plate: photo.cars?.plate || "Nepoznat",
          uploaded_at: photo.uploaded_at,
          photos: [],
        };
      }
      groups[key].photos.push(photo);
    });

    return Object.values(groups);
  };

  const deletePhoto = async (photoId: number, photoUrl: string) => {
    if (!confirm("Da li sigurno želiš da obrišeš ovu sliku?")) return;

    const { error: dbError } = await supabase
      .from("car_photos")
      .delete()
      .eq("id", photoId);

    if (dbError) {
      alert("Greška pri brisanju iz baze!");
      return;
    }

    const filePath = photoUrl.split("/").pop();
    if (filePath) {
      await supabase.storage
        .from("car-photos")
        .remove([`cars/${filePath}`]);
    }

    fetchData();
    alert("✅ Slika je obrisana!");
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

  // ⭐ NAVIGACIJA ZA GALERIJU ⭐
  const nextPhoto = () => {
    if (selectedGroup && selectedPhotoIndex < selectedGroup.photos.length - 1) {
      setSelectedPhotoIndex(selectedPhotoIndex + 1);
    }
  };

  const prevPhoto = () => {
    if (selectedGroup && selectedPhotoIndex > 0) {
      setSelectedPhotoIndex(selectedPhotoIndex - 1);
    }
  };

  const openGroup = (group: PhotoGroup) => {
    setSelectedGroup(group);
    setSelectedPhotoIndex(0);
  };

  const closeGallery = () => {
    setSelectedGroup(null);
    setSelectedPhotoIndex(0);
  };

  if (!isAdmin) {
    return (
      <div className="p-4 text-center text-slate-400">
        <p>Proveravam pristup...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-slate-400">
        <span className="inline-block animate-spin mr-2">⏳</span> Učitavanje podataka...
      </div>
    );
  }

  const start = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-4 space-y-6">
      <h1 className="text-2xl font-bold text-white">🛠️ Admin panel</h1>

      {/* Statistika */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 bg-[#12121a]/90 backdrop-blur-xl">
          <CardHeader className="py-3">
            <CardTitle className="text-sm text-slate-400">👤 Vozači</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{drivers.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-[#12121a]/90 backdrop-blur-xl">
          <CardHeader className="py-3">
            <CardTitle className="text-sm text-slate-400">📸 Slike</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{photos.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-[#12121a]/90 backdrop-blur-xl">
          <CardHeader className="py-3">
            <CardTitle className="text-sm text-slate-400">📅 Rasporedi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{schedules.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* ⭐ RASPORED SVIH VOZAČA ⭐ */}
      <Card className="border-0 bg-[#12121a]/90 backdrop-blur-xl">
        <CardHeader className="flex flex-row justify-between items-center">
          <div>
            <CardTitle className="text-white text-lg">📅 Raspored svih vozača</CardTitle>
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
        </CardHeader>
        <CardContent className="overflow-x-auto">
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

      {/* ⭐ LISTA VOZAČA ⭐ */}
      <Card className="border-0 bg-[#12121a]/90 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white text-lg">👤 Svi vozači</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {drivers.map((driver) => (
              <div key={driver.id} className="flex justify-between items-center p-2 bg-slate-800/30 rounded">
                <div>
                  <p className="text-white font-medium">{driver.full_name}</p>
                  <p className="text-sm text-slate-400">{driver.email}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  driver.role === "admin" ? "bg-purple-600/20 text-purple-400" : "bg-blue-600/20 text-blue-400"
                }`}>
                  {driver.role}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ⭐ SLIKE - GRUPISANE PO UPLOAD-U ⭐ */}
      <Card className="border-0 bg-[#12121a]/90 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white text-lg">📸 Istorija slika</CardTitle>
        </CardHeader>
        <CardContent>
          {photoGroups.length === 0 ? (
            <p className="text-slate-400">Nema postavljenih slika</p>
          ) : (
            <div className="space-y-3">
              {photoGroups.map((group) => (
                <Card 
                  key={group.id}
                  className="border border-slate-700 bg-slate-800/20 hover:bg-slate-800/40 cursor-pointer transition-all hover:border-blue-500/50"
                  onClick={() => openGroup(group)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">
                          👤 {group.driver_name}
                          <span className="text-slate-400 text-sm ml-2">({group.driver_email})</span>
                        </p>
                        <p className="text-sm text-blue-400">
                          🚗 {group.car_name} 
                          <span className="text-slate-400 text-xs ml-2">({group.car_plate})</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          📅 {new Date(group.uploaded_at).toLocaleString("sr-RS", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Europe/Belgrade",
                          })}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          📸 {group.photos.length} slika
                        </p>
                      </div>
                      <div className="text-slate-500 text-2xl">›</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ⭐ GALERIJA - PRIKAZ SVIH SLIKA IZ GRUPE ⭐ */}
      {selectedGroup && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={closeGallery}>
          <div className="relative max-w-4xl w-full max-h-[90vh] bg-[#12121a] rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-slate-700">
              <div>
                <h3 className="text-white font-medium">
                  {selectedGroup.driver_name}
                  <span className="text-slate-400 text-sm ml-2">({selectedGroup.driver_email})</span>
                </h3>
                <p className="text-sm text-blue-400">
                  🚗 {selectedGroup.car_name} ({selectedGroup.car_plate})
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeGallery} className="text-slate-400 hover:text-white">
                <X size={24} />
              </Button>
            </div>

            <div className="relative p-4">
              {/* Glavna slika */}
              <div className="relative flex items-center justify-center min-h-[400px]">
                <img
                  src={selectedGroup.photos[selectedPhotoIndex]?.photo_url}
                  alt={`Slika ${selectedPhotoIndex + 1}`}
                  className="max-h-[60vh] object-contain rounded-lg"
                />

                {/* Navigacija za slike */}
                <div className="absolute inset-0 flex items-center justify-between pointer-events-none">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="pointer-events-auto bg-black/50 hover:bg-black/70 text-white rounded-full p-2 ml-2"
                    onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                    disabled={selectedPhotoIndex === 0}
                  >
                    <ChevronLeft size={24} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="pointer-events-auto bg-black/50 hover:bg-black/70 text-white rounded-full p-2 mr-2"
                    onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                    disabled={selectedPhotoIndex === selectedGroup.photos.length - 1}
                  >
                    <ChevronRight size={24} />
                  </Button>
                </div>
              </div>

              {/* Thumbnails */}
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {selectedGroup.photos.map((photo, index) => (
                  <img
                    key={photo.id}
                    src={photo.photo_url}
                    alt={`Slika ${index + 1}`}
                    className={`w-20 h-20 object-cover rounded-lg cursor-pointer transition-all ${
                      index === selectedPhotoIndex ? 'ring-2 ring-blue-500' : 'opacity-50 hover:opacity-100'
                    }`}
                    onClick={() => setSelectedPhotoIndex(index)}
                  />
                ))}
              </div>

              <p className="text-center text-slate-500 text-sm mt-4">
                {selectedPhotoIndex + 1} / {selectedGroup.photos.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}