"use client";

import { Inter } from "next/font/google";
import { Home, Car, Calendar, Bell, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      console.log("🔍 Proveravam sesiju...");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.log("❌ Greška pri dohvatanju sesije:", sessionError);
        setIsLoggedIn(false);
        setLoading(false);
        return;
      }

      if (session?.user) {
        console.log("✅ Korisnik je prijavljen:", session.user.email);
        setIsLoggedIn(true);
        setLoading(false);

        const { data, error: roleError } = await supabase
          .from("drivers")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();

        if (roleError) {
          console.log("❌ Greška pri proveri uloge:", roleError);
        } else if (data) {
          console.log("🔑 Uloga:", data.role);
          setIsAdmin(data.role === "admin");
        } else {
          console.log("⚠️ Korisnik nije pronađen u drivers tabeli");
          const { error: insertError } = await supabase.from("drivers").insert({
            id: session.user.id,
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name || session.user.email,
            role: "driver",
          });
          if (insertError) {
            console.log("❌ Greška pri dodavanju:", insertError);
          } else {
            console.log("✅ Korisnik dodat u drivers tabelu!");
          }
        }
      } else {
        console.log("❌ Nema prijavljenog korisnika");
        setIsLoggedIn(false);
        setLoading(false);
      }
    };

    checkUser();
  }, []);

  // ⭐ DVA RAZLIČITA MENIJA ⭐
  let navItems = [];

  if (isAdmin) {
    navItems = [
      { name: "Početna", href: "/home", icon: Home },
      { name: "Automobili", href: "/cars", icon: Car },
      { name: "Obaveštenja", href: "/notifications", icon: Bell },
      { name: "Admin Panel", href: "/admin", icon: Settings },
    ];
  } else {
    navItems = [
      { name: "Početna", href: "/home", icon: Home },
      { name: "Automobili", href: "/cars", icon: Car },
      { name: "Raspored", href: "/schedule", icon: Calendar },
      { name: "Obaveštenja", href: "/notifications", icon: Bell },
    ];
  }

  const isLoginPage = pathname === "/";

  if (loading && !isLoggedIn && !isLoginPage) {
    return (
      <html lang="sr" className={inter.className}>
        <body className="bg-[#0a0a0f]">
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-slate-400 text-lg">⏳ Učitavanje...</div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="sr" className={inter.className}>
      <body className="bg-[#0a0a0f]">
        <main className={isLoginPage ? "pb-0" : "pb-20"}>{children}</main>

        {isLoggedIn && !isLoginPage && (
          <nav className="fixed bottom-0 left-0 right-0 bg-[#12121a]/90 backdrop-blur-xl border-t border-slate-800 shadow-2xl shadow-black/50 z-50">
            <div className="flex justify-around items-center h-16">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex flex-col items-center gap-0.5 text-xs transition-all duration-200 relative ${
                      isActive 
                        ? "text-blue-500" 
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
                    <span className={isActive ? "font-medium" : ""}>{item.name}</span>
                    {isActive && (
                      <span className="absolute -top-0.5 w-6 h-0.5 bg-blue-500 rounded-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </body>
    </html>
  );
}