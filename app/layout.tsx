"use client";

import { Home, Car, Calendar, Bell, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import "./globals.css";

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
      // Mala pauza da se sesija učita
      await new Promise((resolve) => setTimeout(resolve, 300));
      console.log("🔍 Proveravam sesiju...");

      // 1. Dohvati sesiju
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
        console.log("🆔 ID korisnika:", session.user.id);
        setIsLoggedIn(true);

        // 2. Proveri da li korisnik postoji u 'drivers' tabeli
        const { data: existingDriver, error: fetchError } = await supabase
          .from("drivers")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle(); // <- Ovo je ključna promena! Ne baca grešku ako nema rezultata.

        if (fetchError) {
          console.log("❌ Greška pri dohvatanju vozača:", fetchError);
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        // 3. Ako korisnik NE postoji u 'drivers' tabeli, dodaj ga
        if (!existingDriver) {
          console.log(
            "⚠️ Korisnik nije pronađen u 'drivers' tabeli. Dodajem ga..."
          );

          const { error: insertError } = await supabase.from("drivers").insert({
            id: session.user.id,
            email: session.user.email,
            full_name:
              session.user.user_metadata?.full_name || session.user.email,
            role: "driver", // Podrazumevana uloga
          });

          if (insertError) {
            console.log("❌ Greška pri dodavanju korisnika:", insertError);
            setIsAdmin(false);
          } else {
            console.log("✅ Korisnik je uspešno dodat u 'drivers' tabelu!");
            // Pošto je dodat kao 'driver', nije admin
            setIsAdmin(false);
          }
        } else {
          // 4. Ako postoji, proveri ulogu
          console.log("✅ Korisnik pronađen u 'drivers' tabeli.");
          console.log("🔑 Uloga:", existingDriver.role);
          setIsAdmin(existingDriver.role === "admin");
        }
      } else {
        console.log("❌ Nema prijavljenog korisnika");
        setIsLoggedIn(false);
      }

      setLoading(false);
    };

    checkUser();
  }, []);

  // Navigacioni items (osnovni)
  const navItems = [
    { name: "Početna", href: "/home", icon: Home },
    { name: "Automobili", href: "/cars", icon: Car },
    { name: "Raspored", href: "/schedule", icon: Calendar },
    { name: "Obaveštenja", href: "/notifications", icon: Bell },
  ];

  // Dodaj admin link SAMO ako je admin
  if (isAdmin) {
    navItems.push({ name: "Admin", href: "/admin", icon: Settings });
  }

  // Login stranica je "/"
  const isLoginPage = pathname === "/";

  return (
    <html lang="sr">
      <body className="bg-gray-50">
        {/* Glavni sadržaj */}
        <main className={isLoginPage ? "pb-0" : "pb-20"}>{children}</main>

        {/* Donji meni - SAMO ako je korisnik prijavljen i nije na login stranici */}
        {isLoggedIn && !isLoginPage && !loading && (
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
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
                    className={`flex flex-col items-center gap-1 text-xs ${
                      isActive ? "text-blue-600" : "text-gray-500"
                    }`}
                  >
                    <Icon size={24} />
                    <span>{item.name}</span>
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