"use client";

import { Inter } from "next/font/google";
import { Home, Car, Calendar, Bell, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import SWRegister from './sw-register';
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
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ⭐ 1. Prvo provjeri trenutnu sesiju ⭐
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setIsLoggedIn(true);
        await fetchUserRole(session.user.id);
      } else {
        setIsLoggedIn(false);
        setLoading(false);
      }
    };

    // ⭐ 2. Funkcija za dohvat uloge ⭐
    const fetchUserRole = async (userId: string) => {
      const { data } = await supabase
        .from("drivers")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      setIsAdmin(data?.role === "admin");
      setLoading(false);
    };

    // ⭐ 3. Slušamo PROMJENE na auth-u (login/logout) ⭐
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Korisnik se upravo ulogovao - ODMAH ažuriramo stanje
          setIsLoggedIn(true);
          setLoading(false);
          await fetchUserRole(session.user.id);
          // ⭐ Preusmjerimo na home ako smo na login stranici ⭐
          if (pathname === '/') {
            router.push('/home');
          }
        } else if (event === 'SIGNED_OUT') {
          // Korisnik se odjavio
          setIsLoggedIn(false);
          setIsAdmin(false);
          setLoading(false);
          if (pathname !== '/') {
            router.push('/');
          }
        }
      }
    );

    checkSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router]);

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

  // ⭐ LOADING: SAMO na login stranici i dok se učitava ⭐
  if (loading && isLoginPage) {
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