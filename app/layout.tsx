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
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      console.log('🔍 Session error:', error);
      console.log('🔍 Sesija:', session?.user?.email || 'Nema sesije');

      if (session?.user) {
        setIsLoggedIn(true);
        await fetchUserRole(session.user.id);
      } else {
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        if (refreshedSession?.user) {
        setIsLoggedIn(false);
        setLoading(false);
      }
    }
    };

    const fetchUserRole = async (userId: string) => {
      const { data } = await supabase
        .from("drivers")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      setIsAdmin(data?.role === "admin");
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setIsLoggedIn(true);
          setLoading(false);
          await fetchUserRole(session.user.id);
          if (pathname === '/') {
            router.push('/home');
          }
        } else if (event === 'SIGNED_OUT') {
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

  // ⭐ AUTOMATSKA PRETPLATA SA ČEKANJEM NA SW ⭐
  useEffect(() => {
    const waitForSW = async () => {
      if (!isLoggedIn) return null;
      
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            if (registration.active) {
              console.log('✅ SW već aktivan');
              return registration;
            } else {
              console.log('⏳ Čekam da SW postane aktivan...');
              await new Promise((resolve) => {
                const checkActive = () => {
                  if (registration.active) {
                    console.log('✅ SW je aktivan!');
                    resolve(null);
                  } else {
                    setTimeout(checkActive, 500);
                  }
                };
                checkActive();
              });
              return registration;
            }
          } else {
            console.log('❌ Nema SW registracije');
            return null;
          }
        } catch (error) {
          console.log('❌ Greška pri čekanju SW:', error);
          return null;
        }
      }
      return null;
    };

    const autoSubscribe = async () => {
      if (!isLoggedIn) return;

      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await waitForSW();
          if (!registration) {
            console.log('❌ SW nije dostupan');
            return;
          }

          const existingSubscription = await registration.pushManager.getSubscription();
          if (existingSubscription) {
            console.log('✅ Već pretplaćen');
            return;
          }

          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            console.log('❌ Notifikacije odbijene');
            return;
          }

          const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!publicKey) {
            console.log('❌ VAPID ključ nedostaje');
            return;
          }

          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: publicKey,
          });

          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            console.log('❌ Nema sesije');
            return;
          }

          const response = await fetch('/api/subscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(subscription),
          });

          if (response.ok) {
            console.log('✅ Notifikacije automatski uključene');
          } else {
            console.log('❌ Greška pri čuvanju pretplate');
          }
        } catch (error) {
          console.log('❌ Greška pri automatskoj pretplati:', error);
        }
      }
    };

    autoSubscribe();
  }, [isLoggedIn]);

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