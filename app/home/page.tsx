"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format, isToday } from "date-fns";
import {
  Bell,
  CalendarDays,
  Camera,
  CarFront,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react";
import { signOut, getCurrentUser } from "../lib/authFunctions";
import { supabase } from "../lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NotificationSettings } from "@/components/notification-settings";
import { AppPage, LoadingScreen } from "@/components/app-shell";
import { getShiftLabel } from "../lib/schedule";

type DashboardStats = {
  drivers: number;
  vehicles: number;
  photos: number;
};

type VehicleAssignment = {
  work_date: string;
  shift_type: string | null;
  cars: { name: string; plate: string } | null;
};

type VehicleAssignmentResult = Omit<VehicleAssignment, "cars"> & {
  cars: VehicleAssignment["cars"] | Array<NonNullable<VehicleAssignment["cars"]>>;
};

type ActionCardProps = {
  title: string;
  description: string;
  icon: typeof CarFront;
  tone: string;
  onClick: () => void;
};

function ActionCard({ title, description, icon: Icon, tone, onClick }: ActionCardProps) {
  return (
    <button type="button" onClick={onClick} className="group text-left">
      <Card className="h-full border border-white/8 bg-white/[0.035] py-0 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/20 hover:bg-white/[0.055]">
        <CardContent className="flex h-full flex-col p-4 sm:p-5">
          <div className="mb-5 flex items-start justify-between">
            <div className={`flex size-11 items-center justify-center rounded-2xl border ${tone}`}>
              <Icon size={21} strokeWidth={1.8} />
            </div>
            <ChevronRight size={18} className="mt-1 text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
          </div>
          <p className="font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
        </CardContent>
      </Card>
    </button>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <Card className="border border-white/8 bg-white/[0.035] py-0">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</span>
          <Icon size={16} />
        </div>
        <p className="text-2xl font-semibold tracking-tight text-white">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState("Driver");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({ drivers: 0, vehicles: 0, photos: 0 });
  const [nextAssignment, setNextAssignment] = useState<VehicleAssignment | null>(null);

  useEffect(() => {
    let active = true;

    const checkUser = async () => {
      const { user } = await getCurrentUser();
      if (!user) {
        router.replace("/");
        return;
      }

      const { data } = await supabase
        .from("drivers")
        .select("role, full_name")
        .eq("id", user.id)
        .single();

      if (!active) return;

      const admin = data?.role === "admin";
      setIsAdmin(admin);
      setDisplayName(data?.full_name || user.email?.split("@")[0] || "Driver");

      if (admin) {
        const [driversResult, vehiclesResult, photosResult] = await Promise.all([
          supabase.from("drivers").select("id", { count: "exact", head: true }).neq("role", "admin"),
          supabase.from("cars").select("id", { count: "exact", head: true }),
          supabase.from("car_photos").select("id", { count: "exact", head: true }),
        ]);

        if (!active) return;
        setStats({
          drivers: driversResult.count ?? 0,
          vehicles: vehiclesResult.count ?? 0,
          photos: photosResult.count ?? 0,
        });
      } else {
        const { data: assignment, error: assignmentError } = await supabase
          .from("work_schedule")
          .select("work_date, shift_type, cars(name, plate)")
          .eq("driver_id", user.id)
          .not("car_id", "is", null)
          .gte("work_date", format(new Date(), "yyyy-MM-dd"))
          .order("work_date", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!assignmentError && active) {
          const loadedAssignment = assignment as unknown as VehicleAssignmentResult | null;
          setNextAssignment(
            loadedAssignment
              ? {
                  ...loadedAssignment,
                  cars: Array.isArray(loadedAssignment.cars)
                    ? loadedAssignment.cars[0] ?? null
                    : loadedAssignment.cars,
                }
              : null
          );
        }
      }

      setLoading(false);
    };

    void checkUser();
    return () => {
      active = false;
    };
  }, [router]);

  const handleLogout = async () => {
    await signOut();
    router.replace("/");
  };

  if (loading) return <LoadingScreen label="Preparing your workspace..." />;

  const actions = isAdmin
    ? [
        {
          title: "Admin dashboard",
          description: "Drivers, weekly schedules and photo history",
          icon: LayoutDashboard,
          tone: "border-cyan-300/15 bg-cyan-300/10 text-cyan-300",
          href: "/admin",
        },
        {
          title: "Vehicles",
          description: "Open the fleet and upload vehicle photos",
          icon: CarFront,
          tone: "border-emerald-300/15 bg-emerald-300/10 text-emerald-300",
          href: "/cars",
        },
        {
          title: "Announcements",
          description: "Publish messages and send phone notifications",
          icon: Bell,
          tone: "border-violet-300/15 bg-violet-300/10 text-violet-300",
          href: "/notifications",
        },
        {
          title: "Driver schedule",
          description: "Review every driver in a compact weekly view",
          icon: CalendarDays,
          tone: "border-amber-300/15 bg-amber-300/10 text-amber-300",
          href: "/scheduleall",
        },
      ]
    : [
        {
          title: "Vehicles",
          description: "Choose a vehicle and upload your photo report",
          icon: CarFront,
          tone: "border-cyan-300/15 bg-cyan-300/10 text-cyan-300",
          href: "/cars",
        },
        {
          title: "My schedule",
          description: "Set your availability for the selected week",
          icon: CalendarDays,
          tone: "border-emerald-300/15 bg-emerald-300/10 text-emerald-300",
          href: "/schedule",
        },
        {
          title: "Announcements",
          description: "Read important updates from your administrator",
          icon: Bell,
          tone: "border-violet-300/15 bg-violet-300/10 text-violet-300",
          href: "/notifications",
        },
      ];

  return (
    <AppPage>
      <header className="relative overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-br from-white/[0.065] to-white/[0.02] p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/70">
              {isAdmin ? "Administration" : "Driver workspace"}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Welcome, {displayName}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {isAdmin ? "Your fleet overview at a glance." : "Everything you need for today’s shift."}
            </p>
          </div>
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/15 bg-cyan-300/10 text-sm font-bold uppercase text-cyan-200">
            {displayName.charAt(0)}
          </div>
        </div>
      </header>

      {isAdmin && (
        <section>
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            <StatCard label="Drivers" value={stats.drivers} icon={Users} />
            <StatCard label="Vehicles" value={stats.vehicles} icon={CarFront} />
            <StatCard label="Photos" value={stats.photos} icon={Camera} />
          </div>
        </section>
      )}

      {!isAdmin && nextAssignment?.cars && (
        <section className="relative overflow-hidden rounded-3xl border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[0.08] to-cyan-300/[0.035] p-4 sm:p-5">
          <div className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-emerald-300/10 blur-3xl" />
          <div className="relative flex items-center gap-3.5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
              <CarFront size={23} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300/70">
                Next assigned vehicle
              </p>
              <p className="mt-1 truncate font-semibold text-white">
                {nextAssignment.cars.name} · {nextAssignment.cars.plate}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {isToday(new Date(`${nextAssignment.work_date}T12:00:00`))
                  ? "Today"
                  : format(new Date(`${nextAssignment.work_date}T12:00:00`), "EEEE, MMM d")}
                {" · "}{getShiftLabel(nextAssignment.shift_type)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => router.push("/schedule")}
              aria-label="Open schedule"
              className="rounded-xl text-emerald-300 hover:bg-emerald-300/10 hover:text-emerald-200"
            >
              <ChevronRight />
            </Button>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-white">Quick access</h2>
            <p className="mt-0.5 text-xs text-slate-500">Open the tools you use most.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {actions.map((action) => (
            <ActionCard
              key={action.href}
              title={action.title}
              description={action.description}
              icon={action.icon}
              tone={action.tone}
              onClick={() => router.push(action.href)}
            />
          ))}
        </div>
      </section>

      <NotificationSettings />

      <Button
        type="button"
        onClick={handleLogout}
        variant="outline"
        className="h-11 w-full rounded-xl border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.05] hover:text-white"
      >
        <LogOut size={17} className="mr-1" />
        Sign out
      </Button>

      <p className="text-center text-[11px] text-slate-700">
        ROTRG Taxi · {new Date().getFullYear()}
      </p>
    </AppPage>
  );
}
