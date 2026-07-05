"use client";

import { useRouter } from "next/navigation";
import { signOut } from "../lib/authFunctions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Calendar, Bell, Settings, LogOut } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  const features = [
    {
      title: "Automobili",
      description: "Pregled i slikanje vozila",
      icon: Car,
      href: "/cars",
      color: "from-blue-600 to-blue-800",
      glow: "shadow-blue-600/20",
    },
    {
      title: "Raspored",
      description: "Prijava smena",
      icon: Calendar,
      href: "/schedule",
      color: "from-emerald-600 to-emerald-800",
      glow: "shadow-emerald-600/20",
    },
    {
      title: "Obaveštenja",
      description: "Važne poruke od admina",
      icon: Bell,
      href: "/notifications",
      color: "from-purple-600 to-purple-800",
      glow: "shadow-purple-600/20",
    },
    {
      title: "Admin",
      description: "Upravljanje sistemom",
      icon: Settings,
      href: "/admin",
      color: "from-orange-600 to-orange-800",
      glow: "shadow-orange-600/20",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center pt-4">
          <div>
            <h1 className="text-2xl font-bold text-white">🚕 ROTRG</h1>
            <p className="text-sm text-slate-400">Dobrodošli nazad</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <span className="text-white font-bold text-sm">👤</span>
          </div>
        </div>

        {/* Grid kartica */}
        <div className="grid grid-cols-2 gap-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="cursor-pointer border-0 bg-[#12121a]/90 backdrop-blur-xl hover:bg-[#1a1a28]/90 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl"
                onClick={() => router.push(feature.href)}
              >
                <CardHeader className="pb-2">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg ${feature.glow}`}>
                    <Icon size={22} className="text-white" />
                  </div>
                  <CardTitle className="text-sm text-white mt-2">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-400">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Odjava */}
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