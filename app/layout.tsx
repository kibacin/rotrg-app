"use client";

import { Inter } from "next/font/google";
import { Home, Car, CalendarDays, Bell, LayoutDashboard } from "lucide-react";
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

  let navItems;

  if (isAdmin) {
    navItems = [
      { name: "Home", href: "/home", icon: Home },
      { name: "Vehicles", href: "/cars", icon: Car },
      { name: "Alerts", href: "/notifications", icon: Bell },
      { name: "Admin", href: "/admin", icon: LayoutDashboard },
    ];
  } else {
    navItems = [
      { name: "Home", href: "/home", icon: Home },
      { name: "Vehicles", href: "/cars", icon: Car },
      { name: "Schedule", href: "/schedule", icon: CalendarDays },
      { name: "Alerts", href: "/notifications", icon: Bell },
    ];
  }

  const isLoginPage = pathname === "/";

  const isRedirecting =
    (isLoginPage && isLoggedIn) || (!isLoginPage && !isLoggedIn);

  if (loading || isRedirecting) {
    return (
      <html lang="en" className={inter.className}>
        <body>
          <div className="min-h-screen flex items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <span className="size-5 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />
              Loading...
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className={inter.className}>
      <body>
        <SWRegister />
        <main className={isLoginPage ? "pb-0" : "pb-24"}>{children}</main>

        {isLoggedIn && !isLoginPage && (
          <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.7rem,env(safe-area-inset-bottom))] pt-2">
            <div className="mx-auto flex h-16 max-w-xl items-center justify-around rounded-2xl border border-white/10 bg-[#0d1521]/90 px-1 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`relative flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] transition-all duration-200 ${
                      isActive 
                        ? "bg-cyan-300/10 text-cyan-300" 
                        : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                    }`}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.25 : 1.6} />
                    <span className={isActive ? "font-medium" : ""}>{item.name}</span>
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
