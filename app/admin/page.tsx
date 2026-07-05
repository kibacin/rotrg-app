"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/authFunctions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

type Driver = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
};

type CarPhoto = {
  id: number;
  car_id: number;
  driver_id: string;
  photo_url: string;
  uploaded_at: string;
  cars: {
    name: string;
    plate: string;
  };
  drivers: {
    full_name: string;
  };
};

export default function AdminPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [photos, setPhotos] = useState<CarPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  // Proveri da li je ulogovani korisnik admin
  useEffect(() => {
    const checkAdmin = async () => {
      const { user } = await getCurrentUser();
      if (!user) {
        router.push("/");
        return;
      }

      // Proveri da li je admin
      const { data, error } = await supabase
        .from("drivers")
        .select("role")
        .eq("id", user.id)
        .single();

      if (error || data?.role !== "admin") {
        router.push("/home");
        return;
      }

      setIsAdmin(true);
      fetchData();
    };

    checkAdmin();
  }, []);

  // Učitaj sve podatke
  const fetchData = async () => {
    setLoading(true);

    // 1. Učitaj sve vozače
    const { data: driversData } = await supabase
      .from("drivers")
      .select("*")
      .order("full_name");

    if (driversData) setDrivers(driversData);

    // 2. Učitaj sve slike sa detaljima
    const { data: photosData } = await supabase
      .from("car_photos")
      .select(`
        *,
        cars (name, plate),
        drivers (full_name)
      `)
      .order("uploaded_at", { ascending: false });

    if (photosData) setPhotos(photosData);
    setLoading(false);
  };

  // Obriši sliku
  const deletePhoto = async (photoId: number, photoUrl: string) => {
    if (!confirm("Da li sigurno želiš da obrišeš ovu sliku?")) return;

    // 1. Obriši iz baze
    const { error: dbError } = await supabase
      .from("car_photos")
      .delete()
      .eq("id", photoId);

    if (dbError) {
      alert("Greška pri brisanju iz baze!");
      return;
    }

    // 2. Obriši iz storage-a
    const filePath = photoUrl.split("/").pop();
    if (filePath) {
      await supabase.storage
        .from("car-photos")
        .remove([`cars/${filePath}`]);
    }

    // 3. Osveži listu
    fetchData();
    alert("✅ Slika je obrisana!");
  };

  if (!isAdmin) {
    return (
      <div className="p-4 text-center">
        <p>Proveravam pristup...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <p>⏳ Učitavanje podataka...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">🛠️ Admin panel</h1>

      {/* Statistika */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-lg">👤 Vozači</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{drivers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-lg">📸 Slike</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{photos.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista vozača */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">👤 Svi vozači</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {drivers.map((driver) => (
              <div key={driver.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{driver.full_name}</p>
                  <p className="text-sm text-gray-500">{driver.email}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  driver.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                }`}>
                  {driver.role}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sve slike */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📸 Sve slike</CardTitle>
        </CardHeader>
        <CardContent>
          {photos.length === 0 ? (
            <p className="text-gray-500">Nema postavljenih slika</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="border rounded-lg p-2 space-y-2">
                  <img
                    src={photo.photo_url}
                    alt="Auto"
                    className="w-full h-32 object-cover rounded"
                  />
                  <div className="text-sm">
                    <p className="font-medium">{photo.cars?.name || "Nepoznat auto"}</p>
                    <p className="text-gray-500">{photo.cars?.plate}</p>
                    <p className="text-xs text-gray-400">Vozač: {photo.drivers?.full_name || "Nepoznat"}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(photo.uploaded_at).toLocaleDateString()}
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => deletePhoto(photo.id, photo.photo_url)}
                    >
                      Obriši
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}