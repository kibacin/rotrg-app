"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, CarFront, Check, Upload, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/authFunctions";
import { AppPage, LoadingScreen, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CameraCapture } from "@/components/camera-capture";

type Car = {
  id: number;
  name: string;
  plate: string;
  year: number;
};

export default function CarsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCar, setSelectedCar] = useState<number | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let active = true;

    const loadPage = async () => {
      const [{ user }, carsResult] = await Promise.all([
        getCurrentUser(),
        supabase.from("cars").select("id, name, plate, year").order("name"),
      ]);

      const profileResult = user
        ? await supabase.from("drivers").select("role").eq("id", user.id).maybeSingle()
        : { data: null };

      if (!active) return;
      setUserId(user?.id ?? null);
      setIsAdmin(profileResult.data?.role === "admin");
      if (carsResult.error) {
        console.error("Could not load vehicles:", carsResult.error);
      }
      setCars((carsResult.data ?? []) as Car[]);
      setLoading(false);
    };

    void loadPage();
    return () => {
      active = false;
    };
  }, []);

  const selectedCarDetails = useMemo(
    () => cars.find((car) => car.id === selectedCar) ?? null,
    [cars, selectedCar]
  );

  const resetPhotos = () => {
    setPhotos([]);
  };

  const handleCarSelect = (carId: number) => {
    setSelectedCar(carId);
    resetPhotos();
  };

  const closeUpload = () => {
    if (uploading) return;
    resetPhotos();
    setSelectedCar(null);
  };

  const handleSavePhotos = async () => {
    if (!selectedCar || !userId || photos.length < 6 || photos.length > 8) return;

    setUploading(true);
    const uploadedPaths: string[] = [];
    const reportId = crypto.randomUUID();
    try {
      const { error: draftError } = await supabase.from("car_reports").insert({
        id: reportId,
        car_id: selectedCar,
        driver_id: userId,
        status: "draft",
      });
      if (draftError) throw draftError;

      for (const photo of photos) {
        const filePath = `${userId}/${reportId}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("car-photos")
          .upload(filePath, photo, {
            contentType: "image/jpeg",
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;
        uploadedPaths.push(filePath);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your session expired. Please sign in again.");
      const response = await fetch("/api/car-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reportId, paths: uploadedPaths }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "The report could not be finalized");

      resetPhotos();
      setSelectedCar(null);
      alert("Photo report uploaded successfully.");
    } catch (error) {
      if (uploadedPaths.length > 0) {
        const { error: cleanupError } = await supabase.storage
          .from("car-photos")
          .remove(uploadedPaths);
        if (cleanupError) {
          console.error("Could not clean up an incomplete photo upload:", cleanupError);
        }
      }
      await supabase.from("car_reports").delete().eq("id", reportId).eq("status", "draft");
      const message = error instanceof Error ? error.message : "The photos could not be uploaded";
      alert(`Error: ${message}`);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <LoadingScreen label="Loading vehicles..." />;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Fleet reports"
        title="Vehicles"
        description={isAdmin
          ? "Choose a vehicle to submit a 6-8 photo report, or review reports in the admin dashboard."
          : "Choose a vehicle and take a 6-8 photo camera report."}
        icon={CarFront}
      />

      {cars.length === 0 ? (
        <Card className="border border-white/8 bg-white/[0.03] py-0">
          <CardContent className="py-16 text-center">
            <CarFront className="mx-auto mb-3 text-slate-700" size={38} />
            <p className="text-sm text-slate-500">No vehicles have been added yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cars.map((car) => {
            const selected = selectedCar === car.id;
            return (
              <button type="button" key={car.id} onClick={() => handleCarSelect(car.id)} className="text-left">
                <Card
                  className={`h-full border py-0 transition duration-200 ${
                    selected
                      ? "border-cyan-300/30 bg-cyan-300/[0.07] shadow-[0_18px_50px_rgba(34,211,238,0.08)]"
                      : "border-white/8 bg-white/[0.03] hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.05]"
                  }`}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="mb-5 flex items-center justify-between">
                      <div className={`flex size-11 items-center justify-center rounded-2xl border ${
                        selected
                          ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-300"
                          : "border-white/8 bg-white/5 text-slate-500"
                      }`}>
                        <CarFront size={21} />
                      </div>
                      {selected && (
                        <span className="flex size-6 items-center justify-center rounded-full bg-cyan-300 text-slate-950">
                          <Check size={14} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-white">{car.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>{car.plate}</span>
                      <span className="size-1 rounded-full bg-slate-700" />
                      <span>{car.year}</span>
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {selectedCarDetails && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center"
          onClick={closeUpload}
        >
          <Card
            className="max-h-[92vh] w-full max-w-xl overflow-hidden border border-white/10 bg-[#0d1521] py-0 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <CardContent className="max-h-[92vh] overflow-y-auto p-4 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-violet-300/15 bg-violet-300/10 text-violet-300">
                    <Camera size={21} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white">New photo report</p>
                    <p className="truncate text-xs text-slate-500">
                      {selectedCarDetails.name} · {selectedCarDetails.plate}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={closeUpload}
                  disabled={uploading}
                  aria-label="Close photo upload"
                  className="shrink-0 rounded-xl text-slate-500 hover:bg-white/5 hover:text-white"
                >
                  <X />
                </Button>
              </div>

              <CameraCapture
                files={photos}
                onChange={setPhotos}
                disabled={uploading}
                minimum={6}
                maximum={8}
              />

              <Button
                type="button"
                onClick={handleSavePhotos}
                disabled={photos.length < 6 || photos.length > 8 || uploading || !userId}
                className="mt-5 h-11 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 font-semibold text-slate-950 hover:from-cyan-300 hover:to-blue-400"
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                    Uploading report...
                  </span>
                ) : photos.length < 6 ? (
                  `Take ${6 - photos.length} more ${6 - photos.length === 1 ? "photo" : "photos"}`
                ) : (
                  <span className="flex items-center gap-2">
                    <Upload size={17} />
                    Upload report with {photos.length} photos
                  </span>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </AppPage>
  );
}
