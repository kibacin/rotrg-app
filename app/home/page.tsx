"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "../lib/authFunctions";
import { getCurrentUser } from "../lib/authFunctions";
import { supabase } from "../lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationSettings } from "@/components/notification-settings";
import { Car, Calendar, Bell, Settings, LogOut, Users } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ drivers: 0, photos: 0, schedules: 0 });

  useEffect(() => {
    const checkUser = async () => {
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

      setIsAdmin(data?.role === "admin");

      if (data?.role === "admin") {
        const { count: driversCount } = await supabase
          .from("drivers")
          .select("*", { count: "exact", head: true });
        
        const { count: photosCount } = await supabase
          .from("car_photos")
          .select("*", { count: "exact", head: true });
        
        const { count: schedulesCount } = await supabase
          .from("work_schedule")
          .select("*", { count: "exact", head: true });

        setStats({
          drivers: driversCount || 0,
          photos: photosCount || 0,
          schedules: schedulesCount || 0,
        });
      }

      setLoading(false);
    };

    checkUser();
  }, [router]);

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-slate-400">⏳ Učitavanje...</div>
      </div>
    );
  }

  // ⭐ ADMIN HOMEPAGE ⭐ (NEMA RASPORED KARTICU)
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="p-4 space-y-6">
          <div className="flex justify-between items-center pt-4">
            <div>
              <h1 className="text-2xl font-bold text-white">🚕 ROTRG Admin</h1>
              <p className="text-sm text-slate-400">Upravljanje sistemom</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <span className="text-white font-bold text-sm">A</span>
            </div>
          </div>

          {/* Statistika */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-0 bg-[#12121a]/90 backdrop-blur-xl">
              <CardHeader className="py-3">
                <CardTitle className="text-sm text-slate-400">👤 Vozači</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-white">{stats.drivers}</p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-[#12121a]/90 backdrop-blur-xl">
              <CardHeader className="py-3">
                <CardTitle className="text-sm text-slate-400">📸 Slike</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-white">{stats.photos}</p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-[#12121a]/90 backdrop-blur-xl">
              <CardHeader className="py-3">
                <CardTitle className="text-sm text-slate-400">📅 Rasporedi</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-white">{stats.schedules}</p>
              </CardContent>
            </Card>
          </div>

          {/* ⭐ ADMIN KARTICE (NEMA RASPORED) ⭐ */}
          <div className="grid grid-cols-2 gap-4">
            <Card
              className="cursor-pointer border-0 bg-[#12121a]/90 backdrop-blur-xl hover:bg-[#1a1a28]/90 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl"
              onClick={() => router.push("/admin")}
            >
              <CardHeader className="pb-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-600/20">
                  <Settings size={22} className="text-white" />
                </div>
                <CardTitle className="text-sm text-white mt-2">Admin panel</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-400">Upravljaj sistemom</p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer border-0 bg-[#12121a]/90 backdrop-blur-xl hover:bg-[#1a1a28]/90 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl"
              onClick={() => router.push("/cars")}
            >
              <CardHeader className="pb-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center shadow-lg shadow-emerald-600/20">
                  <Car size={22} className="text-white" />
                </div>
                <CardTitle className="text-sm text-white mt-2">Automobili</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-400">Pregled vozila</p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer border-0 bg-[#12121a]/90 backdrop-blur-xl hover:bg-[#1a1a28]/90 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl"
              onClick={() => router.push("/notifications")}
            >
              <CardHeader className="pb-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center shadow-lg shadow-purple-600/20">
                  <Bell size={22} className="text-white" />
                </div>
                <CardTitle className="text-sm text-white mt-2">Obaveštenja</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-400">Pošalji obaveštenja</p>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer border-0 bg-[#12121a]/90 backdrop-blur-xl hover:bg-[#1a1a28]/90 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl"
              onClick={() => router.push("/scheduleall")}
            >
              <CardHeader className="pb-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-600 to-orange-800 flex items-center justify-center shadow-lg shadow-orange-600/20">
                  <Users size={22} className="text-white" />
                </div>
                <CardTitle className="text-sm text-white mt-2">Raspored vozača</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-400">Pregled svih vozača</p>
              </CardContent>
            </Card>
          </div>

          <NotificationSettings />
          
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
          >
            <LogOut size={18} className="mr-2" />
            Odjavi se
          </Button>
          
          <p className="text-center text-xs text-slate-600 pt-4">
            ROTRG Taxi Admin © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    );
  }

  // ⭐ VOZAČ HOMEPAGE ⭐ (IMA RASPORED, NEMA ADMIN)
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="p-4 space-y-6">
        <div className="flex justify-between items-center pt-4">
          <div>
            <h1 className="text-2xl font-bold text-white">🚕 ROTRG</h1>
            <p className="text-sm text-slate-400">Dobrodošli nazad</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <span className="text-white font-bold text-sm">👤</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card
            className="cursor-pointer border-0 bg-[#12121a]/90 backdrop-blur-xl hover:bg-[#1a1a28]/90 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl"
            onClick={() => router.push("/cars")}
          >
            <CardHeader className="pb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-600/20">
                <Car size={22} className="text-white" />
              </div>
              <CardTitle className="text-sm text-white mt-2">Automobili</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400">Pregled i slikanje vozila</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-0 bg-[#12121a]/90 backdrop-blur-xl hover:bg-[#1a1a28]/90 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl"
            onClick={() => router.push("/schedule")}
          >
            <CardHeader className="pb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center shadow-lg shadow-emerald-600/20">
                <Calendar size={22} className="text-white" />
              </div>
              <CardTitle className="text-sm text-white mt-2">Raspored</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400">Prijava smena</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-0 bg-[#12121a]/90 backdrop-blur-xl hover:bg-[#1a1a28]/90 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl"
            onClick={() => router.push("/notifications")}
          >
            <CardHeader className="pb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center shadow-lg shadow-purple-600/20">
                <Bell size={22} className="text-white" />
              </div>
              <CardTitle className="text-sm text-white mt-2">Obaveštenja</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400">Važne poruke od admina</p>
            </CardContent>
          </Card>
        </div>

        <NotificationSettings />
      
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
        >
          <LogOut size={18} className="mr-2" />
          Odjavi se
        </Button>

        <p className="text-center text-xs text-slate-600 pt-4">
          ROTRG Taxi © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
