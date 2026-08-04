"use client";

import { Inter } from "next/font/google";
import { Home, Car, Calendar, Bell, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import SWRegister from './sw-register';
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabaseClient";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const fetchUserRole = async (userId: string) => {
      const { data } = await supabase
        .from("drivers")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (!isActive) return;
      setIsAdmin(data?.role === "admin");
    };

    const applySession = async (session: Session | null) => {
      if (!isActive) return;

      if (session?.user) {
        setIsLoggedIn(true);
        await fetchUserRole(session.user.id);

        if (!isActive) return;
        setLoading(false);

        if (pathname === '/') {
          router.replace('/home');
        }
        return;
      }

      setIsLoggedIn(false);
      setIsAdmin(false);
      setLoading(false);

      if (pathname !== '/') {
        router.replace('/');
      }
    };

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await applySession(session);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        window.setTimeout(() => {
          void applySession(session);
        }, 0);
      }
    );

    void checkSession();

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  // ⭐ MENI ⭐
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

  const isRedirecting =
    (isLoginPage && isLoggedIn) || (!isLoginPage && !isLoggedIn);

  if (loading || isRedirecting) {
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
        <SWRegister />
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
