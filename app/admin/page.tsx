"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, addWeeks, format, isToday, startOfWeek, subWeeks } from "date-fns";
import {
  CalendarDays,
  Camera,
  CarFront,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Images,
  LayoutDashboard,
  Users,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/authFunctions";
import { AppPage, LoadingScreen, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
  shift_type: string | null;
};

type Car = {
  id: number;
  name: string;
  plate: string;
  year?: number;
};

type CarPhoto = {
  id: number;
  car_id: number;
  driver_id: string;
  photo_url: string;
  uploaded_at: string;
  cars: { name: string; plate: string } | null;
  drivers: { full_name: string; email: string } | null;
};

type PhotoGroup = {
  id: string;
  driverId: string;
  driverName: string;
  driverEmail: string;
  carId: number;
  carName: string;
  carPlate: string;
  uploadedAt: string;
  photos: CarPhoto[];
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function groupPhotos(photos: CarPhoto[]): PhotoGroup[] {
  const groups = new Map<string, PhotoGroup>();

  for (const photo of photos) {
    const dateKey = format(new Date(photo.uploaded_at), "yyyy-MM-dd");
    const key = `${photo.car_id}-${photo.driver_id}-${dateKey}`;
    const existing = groups.get(key);

    if (existing) {
      existing.photos.push(photo);
      continue;
    }

    groups.set(key, {
      id: key,
      driverId: photo.driver_id,
      driverName: photo.drivers?.full_name || "Unknown driver",
      driverEmail: photo.drivers?.email || "No email",
      carId: photo.car_id,
      carName: photo.cars?.name || "Unknown vehicle",
      carPlate: photo.cars?.plate || "No plate",
      uploadedAt: photo.uploaded_at,
      photos: [photo],
    });
  }

  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <Card className="border border-white/8 bg-white/[0.035] py-0">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between text-slate-500">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] sm:text-[11px]">{label}</span>
          <Icon size={16} />
        </div>
        <p className="text-2xl font-semibold text-white">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [photos, setPhotos] = useState<CarPhoto[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());
  const [showAllSchedules, setShowAllSchedules] = useState(false);
  const [showAllDrivers, setShowAllDrivers] = useState(false);
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<PhotoGroup | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  useEffect(() => {
    let active = true;

    const loadAdminData = async () => {
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
      const [driversResult, carsResult, photosResult, schedulesResult] = await Promise.all([
        supabase.from("drivers").select("id, email, full_name, role, created_at").order("full_name"),
        supabase.from("cars").select("id, name, plate, year").order("name"),
        supabase
          .from("car_photos")
          .select("id, car_id, driver_id, photo_url, uploaded_at, cars(name, plate), drivers(full_name, email)")
          .order("uploaded_at", { ascending: false }),
        supabase
          .from("work_schedule")
          .select("id, driver_id, work_date, shift_type")
          .gte("work_date", format(start, "yyyy-MM-dd"))
          .lte("work_date", format(end, "yyyy-MM-dd")),
      ]);

      if (!active) return;
      const loadedCars = (carsResult.data ?? []) as Car[];
      setDrivers((driversResult.data ?? []) as Driver[]);
      setCars(loadedCars);
      setPhotos((photosResult.data ?? []) as unknown as CarPhoto[]);
      setSchedules((schedulesResult.data ?? []) as Schedule[]);
      setSelectedCarId((current) => current ?? loadedCars[0]?.id ?? null);
      setLoading(false);
    };

    void loadAdminData();
    return () => {
      active = false;
    };
  }, [currentWeekStart, router]);

  const operationalDrivers = useMemo(
    () => drivers.filter((driver) => driver.role !== "admin"),
    [drivers]
  );
  const photoGroups = useMemo(() => groupPhotos(photos), [photos]);
  const availableCars = useMemo(() => {
    const result = new Map<number, Car>(cars.map((car) => [car.id, car]));
    for (const photo of photos) {
      if (!result.has(photo.car_id)) {
        result.set(photo.car_id, {
          id: photo.car_id,
          name: photo.cars?.name || "Unknown vehicle",
          plate: photo.cars?.plate || "No plate",
        });
      }
    }
    return Array.from(result.values());
  }, [cars, photos]);
  const selectedCar = availableCars.find((car) => car.id === selectedCarId) ?? null;
  const selectedCarGroups = photoGroups.filter((group) => group.carId === selectedCarId);
  const start = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const visibleScheduleDrivers = showAllSchedules ? operationalDrivers : operationalDrivers.slice(0, 4);
  const visibleDrivers = showAllDrivers ? drivers : drivers.slice(0, 5);

  const openGroup = (group: PhotoGroup) => {
    setSelectedGroup(group);
    setSelectedPhotoIndex(0);
  };

  const closeGallery = () => {
    setSelectedGroup(null);
    setSelectedPhotoIndex(0);
  };

  if (loading) return <LoadingScreen label="Loading the admin dashboard..." />;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Fleet control"
        title="Admin dashboard"
        description="A compact overview of drivers, schedules and vehicle reports."
        icon={LayoutDashboard}
      />

      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <StatCard label="Drivers" value={operationalDrivers.length} icon={Users} />
        <StatCard label="Vehicles" value={cars.length} icon={CarFront} />
        <StatCard label="Photos" value={photos.length} icon={Camera} />
      </div>

      <section className="rounded-3xl border border-white/8 bg-white/[0.025] p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays size={18} className="text-cyan-300" />
              <h2 className="font-semibold text-white">Weekly schedule</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {format(start, "MMM d")} – {format(addDays(start, 6), "MMM d, yyyy")}
            </p>
          </div>
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
        </div>

        <div className="space-y-2">
          {visibleScheduleDrivers.length === 0 ? (
            <p className="rounded-2xl border border-white/7 bg-black/10 p-5 text-center text-sm text-slate-500">
              No drivers found.
            </p>
          ) : (
            visibleScheduleDrivers.map((driver) => {
              const scheduleByDate = new Map(
                schedules
                  .filter((item) => item.driver_id === driver.id)
                  .map((item) => [item.work_date, item.shift_type])
              );

              return (
                <button
                  type="button"
                  key={driver.id}
                  onClick={() => router.push("/scheduleall")}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/7 bg-black/10 p-3 text-left transition hover:border-cyan-300/15 hover:bg-white/[0.04]"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-xs font-semibold text-cyan-200">
                    {driver.full_name?.charAt(0) || "D"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{driver.full_name}</p>
                    <div className="mt-1.5 grid grid-cols-7 gap-1">
                      {weekDays.map((day, index) => {
                        const shift = scheduleByDate.get(format(day, "yyyy-MM-dd"));
                        return (
                          <div key={day.toISOString()} className="min-w-0 text-center">
                            <span className={`block text-[8px] ${isToday(day) ? "text-cyan-300" : "text-slate-600"}`}>
                              {DAY_NAMES[index]}
                            </span>
                            <span className={`mx-auto mt-1 block h-1 w-full max-w-5 rounded-full ${shift ? "bg-cyan-300/55" : "bg-white/5"}`} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-slate-700" />
                </button>
              );
            })
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {operationalDrivers.length > 4 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAllSchedules((value) => !value)}
              className="rounded-xl text-xs text-slate-400 hover:bg-white/5 hover:text-white"
            >
              {showAllSchedules ? "Show less" : `Show ${operationalDrivers.length - 4} more`}
              <ChevronDown className={showAllSchedules ? "rotate-180" : ""} />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/scheduleall")}
            className="rounded-xl text-xs text-cyan-300 hover:bg-cyan-300/10 hover:text-cyan-200"
          >
            Open detailed schedule <ChevronRight />
          </Button>
        </div>
      </section>

      <section className="rounded-3xl border border-white/8 bg-white/[0.025] p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users size={18} className="text-cyan-300" />
              <h2 className="font-semibold text-white">Driver directory</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">Accounts and access roles.</p>
          </div>
          <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-500">
            {drivers.length}
          </span>
        </div>

        <div className="divide-y divide-white/6 overflow-hidden rounded-2xl border border-white/7 bg-black/10">
          {visibleDrivers.map((driver) => (
            <div key={driver.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-xs font-semibold text-slate-300">
                {driver.full_name?.charAt(0) || "D"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{driver.full_name}</p>
                <p className="truncate text-xs text-slate-600">{driver.email}</p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                driver.role === "admin"
                  ? "border-violet-300/15 bg-violet-300/10 text-violet-300"
                  : "border-cyan-300/15 bg-cyan-300/10 text-cyan-300"
              }`}>
                {driver.role}
              </span>
            </div>
          ))}
        </div>

        {drivers.length > 5 && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowAllDrivers((value) => !value)}
            className="mt-3 rounded-xl text-xs text-slate-400 hover:bg-white/5 hover:text-white"
          >
            {showAllDrivers ? "Show less" : `Show all ${drivers.length} accounts`}
            <ChevronDown className={showAllDrivers ? "rotate-180" : ""} />
          </Button>
        )}
      </section>

      <section className="rounded-3xl border border-white/8 bg-white/[0.025] p-4 sm:p-5">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <Images size={18} className="text-cyan-300" />
            <h2 className="font-semibold text-white">Vehicle photo history</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">Choose a vehicle to see all reports from every driver.</p>
        </div>

        {availableCars.length === 0 ? (
          <p className="rounded-2xl border border-white/7 bg-black/10 p-8 text-center text-sm text-slate-500">
            No vehicles have been added yet.
          </p>
        ) : (
          <>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3">
              {availableCars.map((car) => {
                const reports = photoGroups.filter((group) => group.carId === car.id);
                const imageCount = reports.reduce((total, group) => total + group.photos.length, 0);
                const selected = car.id === selectedCarId;

                return (
                  <button
                    type="button"
                    key={car.id}
                    onClick={() => setSelectedCarId(car.id)}
                    className={`min-w-40 rounded-2xl border p-3 text-left transition ${
                      selected
                        ? "border-cyan-300/25 bg-cyan-300/10"
                        : "border-white/8 bg-black/10 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <CarFront size={18} className={selected ? "text-cyan-300" : "text-slate-500"} />
                      <span className="text-[10px] text-slate-600">{imageCount} photos</span>
                    </div>
                    <p className="truncate text-sm font-semibold text-white">{car.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{car.plate}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 rounded-2xl border border-white/7 bg-black/10 p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{selectedCar?.name}</p>
                  <p className="text-xs text-slate-600">{selectedCar?.plate}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-slate-500">
                  {selectedCarGroups.length} reports
                </span>
              </div>

              {selectedCarGroups.length === 0 ? (
                <div className="py-10 text-center">
                  <Camera className="mx-auto mb-2 text-slate-700" size={28} />
                  <p className="text-sm text-slate-500">No photo reports for this vehicle.</p>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedCarGroups.map((group) => (
                    <button
                      type="button"
                      key={group.id}
                      onClick={() => openGroup(group)}
                      className="group flex items-center gap-3 rounded-2xl border border-white/7 bg-white/[0.025] p-3 text-left transition hover:border-cyan-300/15 hover:bg-white/[0.05]"
                    >
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-white/5">
                        <Image
                          src={group.photos[0].photo_url}
                          alt={`${group.carName} report preview`}
                          fill
                          sizes="56px"
                          unoptimized
                          className="object-cover transition duration-300 group-hover:scale-105"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{group.driverName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {new Date(group.uploadedAt).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Europe/Belgrade",
                          })}
                        </p>
                        <p className="mt-1 text-[10px] font-medium text-cyan-300/80">
                          {group.photos.length} {group.photos.length === 1 ? "photo" : "photos"}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-slate-700" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {selectedGroup && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-3 backdrop-blur-md sm:p-6"
          onClick={closeGallery}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b111b] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/8 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{selectedGroup.carName}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {selectedGroup.carPlate} · {selectedGroup.driverName} · {selectedGroup.driverEmail}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={closeGallery}
                aria-label="Close gallery"
                className="rounded-xl text-slate-500 hover:bg-white/5 hover:text-white"
              >
                <X />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
              <div className="relative flex min-h-72 items-center justify-center overflow-hidden rounded-2xl bg-black/35 sm:min-h-[480px]">
                <Image
                  src={selectedGroup.photos[selectedPhotoIndex].photo_url}
                  alt={`${selectedGroup.carName} photo ${selectedPhotoIndex + 1}`}
                  width={1600}
                  height={1200}
                  unoptimized
                  className="max-h-[62vh] w-auto max-w-full object-contain"
                />

                {selectedGroup.photos.length > 1 && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-between p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={selectedPhotoIndex === 0}
                      onClick={() => setSelectedPhotoIndex((index) => Math.max(0, index - 1))}
                      aria-label="Previous photo"
                      className="pointer-events-auto rounded-full bg-black/55 text-white hover:bg-black/75"
                    >
                      <ChevronLeft />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={selectedPhotoIndex === selectedGroup.photos.length - 1}
                      onClick={() => setSelectedPhotoIndex((index) => Math.min(selectedGroup.photos.length - 1, index + 1))}
                      aria-label="Next photo"
                      className="pointer-events-auto rounded-full bg-black/55 text-white hover:bg-black/75"
                    >
                      <ChevronRight />
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {selectedGroup.photos.map((photo, index) => (
                  <button
                    type="button"
                    key={photo.id}
                    onClick={() => setSelectedPhotoIndex(index)}
                    className={`relative size-16 shrink-0 overflow-hidden rounded-xl border transition ${
                      index === selectedPhotoIndex ? "border-cyan-300/70" : "border-white/8 opacity-55 hover:opacity-100"
                    }`}
                  >
                    <Image
                      src={photo.photo_url}
                      alt={`Thumbnail ${index + 1}`}
                      fill
                      sizes="64px"
                      unoptimized
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
              <p className="mt-3 text-center text-xs text-slate-600">
                {selectedPhotoIndex + 1} of {selectedGroup.photos.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </AppPage>
  );
}
