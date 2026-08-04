"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Camera, CarFront, Check, ImagePlus, Upload, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/authFunctions";
import { AppPage, LoadingScreen, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Car = {
  id: number;
  name: string;
  plate: string;
  year: number;
};

export default function CarsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCar, setSelectedCar] = useState<number | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let active = true;

    const loadPage = async () => {
      const [{ user }, carsResult] = await Promise.all([
        getCurrentUser(),
        supabase.from("cars").select("id, name, plate, year").order("name"),
      ]);

      if (!active) return;
      setUserId(user?.id ?? null);
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

  useEffect(() => {
    return () => {
      photoPreviews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [photoPreviews]);

  const selectedCarDetails = useMemo(
    () => cars.find((car) => car.id === selectedCar) ?? null,
    [cars, selectedCar]
  );

  const resetPhotos = () => {
    setPhotos([]);
    setPhotoPreviews([]);
  };

  const handleCarSelect = (carId: number) => {
    setSelectedCar(carId);
    resetPhotos();
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length > 8) {
      alert("You can upload up to 8 photos in one report. The first 8 were selected.");
    }

    const acceptedFiles = selectedFiles.slice(0, 8);
    setPhotos(acceptedFiles);
    setPhotoPreviews(acceptedFiles.map((file) => URL.createObjectURL(file)));
    event.target.value = "";
  };

  const handleSavePhotos = async () => {
    if (!selectedCar || !userId || photos.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];

      for (const photo of photos) {
        const fileExtension = photo.name.split(".").pop() || "jpg";
        const fileName = `${selectedCar}-${Date.now()}-${crypto.randomUUID()}.${fileExtension}`;
        const filePath = `cars/${selectedCar}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from("car-photos")
          .upload(filePath, photo);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("car-photos").getPublicUrl(filePath);
        uploadedUrls.push(data.publicUrl);
      }

      const { error } = await supabase.from("car_photos").insert(
        uploadedUrls.map((photoUrl) => ({
          car_id: selectedCar,
          driver_id: userId,
          photo_url: photoUrl,
        }))
      );

      if (error) throw error;
      resetPhotos();
      alert("Photo report uploaded successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The photos could not be uploaded";
      alert(`Error: ${message}`);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
    setPhotoPreviews((current) => current.filter((_, photoIndex) => photoIndex !== index));
  };

  if (loading) return <LoadingScreen label="Loading vehicles..." />;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Fleet reports"
        title="Vehicles"
        description="Choose a vehicle and upload a clear photo report."
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
        <Card className="border border-white/8 bg-white/[0.03] py-0">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-violet-300/15 bg-violet-300/10 text-violet-300">
                <Camera size={21} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-white">New photo report</p>
                <p className="truncate text-xs text-slate-500">
                  {selectedCarDetails.name} · {selectedCarDetails.plate}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-white/12 bg-black/10 p-4 text-center sm:p-6">
              <Label htmlFor="photos" className="flex cursor-pointer flex-col items-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                  <ImagePlus size={23} />
                </span>
                <span className="mt-3 text-sm font-medium text-white">Choose vehicle photos</span>
                <span className="mt-1 text-xs text-slate-600">Up to 8 images per report</span>
              </Label>
              <Input
                id="photos"
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
                className="sr-only"
              />
            </div>

            {photoPreviews.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-400">Selected photos</p>
                  <span className="text-xs text-slate-600">{photoPreviews.length}/8</span>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photoPreviews.map((preview, index) => (
                    <div key={preview} className="relative aspect-square overflow-hidden rounded-xl border border-white/8 bg-black/20">
                      <Image
                        src={preview}
                        alt={`Selected photo ${index + 1}`}
                        fill
                        sizes="(max-width: 640px) 33vw, 180px"
                        unoptimized
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        aria-label={`Remove photo ${index + 1}`}
                        className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur hover:bg-red-500"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              type="button"
              onClick={handleSavePhotos}
              disabled={photos.length === 0 || uploading || !userId}
              className="mt-5 h-11 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 font-semibold text-slate-950 hover:from-cyan-300 hover:to-blue-400"
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                  Uploading report...
                </span>
              ) : photos.length === 0 ? (
                "Select photos to continue"
              ) : (
                <span className="flex items-center gap-2">
                  <Upload size={17} />
                  Upload {photos.length} {photos.length === 1 ? "photo" : "photos"}
                </span>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </AppPage>
  );
}
