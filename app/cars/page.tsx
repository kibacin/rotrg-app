"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CarFront, Check, ImagePlus, Minimize2, Upload, X } from "lucide-react";
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

const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.78;

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function compressPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });

    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^/.]+$/, "") || "vehicle-photo";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn("The browser could not compress this photo; the original will be used.", error);
    return file;
  }
}

export default function CarsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCar, setSelectedCar] = useState<number | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [originalTotalBytes, setOriginalTotalBytes] = useState(0);
  const previewUrlsRef = useRef<string[]>([]);

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
      previewUrlsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, []);

  const selectedCarDetails = useMemo(
    () => cars.find((car) => car.id === selectedCar) ?? null,
    [cars, selectedCar]
  );

  const resetPhotos = () => {
    previewUrlsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
    previewUrlsRef.current = [];
    setPhotos([]);
    setPhotoPreviews([]);
    setOriginalTotalBytes(0);
  };

  const handleCarSelect = (carId: number) => {
    setSelectedCar(carId);
    resetPhotos();
  };

  const closeUpload = () => {
    if (uploading || compressing) return;
    resetPhotos();
    setSelectedCar(null);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length > 8) {
      alert("You can upload up to 8 photos in one report. The first 8 were selected.");
    }

    const acceptedFiles = selectedFiles.slice(0, 8);
    event.target.value = "";
    if (acceptedFiles.length === 0) return;

    setCompressing(true);
    setOriginalTotalBytes(acceptedFiles.reduce((total, file) => total + file.size, 0));
    const optimizedFiles: File[] = [];
    for (const file of acceptedFiles) {
      optimizedFiles.push(await compressPhoto(file));
    }

    previewUrlsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
    const nextPreviews = optimizedFiles.map((file) => URL.createObjectURL(file));
    previewUrlsRef.current = nextPreviews;
    setPhotos(optimizedFiles);
    setPhotoPreviews(nextPreviews);
    setCompressing(false);
  };

  const handleSavePhotos = async () => {
    if (!selectedCar || !userId || photos.length === 0) return;

    setUploading(true);
    const uploadedPaths: string[] = [];
    try {
      const uploadedUrls: string[] = [];

      for (const photo of photos) {
        const fileExtension = photo.name.split(".").pop() || "jpg";
        const fileName = `${selectedCar}-${crypto.randomUUID()}.${fileExtension}`;
        const filePath = `cars/${selectedCar}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from("car-photos")
          .upload(filePath, photo, { contentType: photo.type || undefined });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("car-photos").getPublicUrl(filePath);
        uploadedUrls.push(data.publicUrl);
        uploadedPaths.push(filePath);
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
      const message = error instanceof Error ? error.message : "The photos could not be uploaded";
      alert(`Error: ${message}`);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    const removedPreview = previewUrlsRef.current[index];
    if (removedPreview) URL.revokeObjectURL(removedPreview);
    previewUrlsRef.current = previewUrlsRef.current.filter((_, photoIndex) => photoIndex !== index);
    setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
    setPhotoPreviews((current) => current.filter((_, photoIndex) => photoIndex !== index));
  };

  const optimizedTotalBytes = photos.reduce((total, photo) => total + photo.size, 0);

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
                  disabled={uploading || compressing}
                  aria-label="Close photo upload"
                  className="shrink-0 rounded-xl text-slate-500 hover:bg-white/5 hover:text-white"
                >
                  <X />
                </Button>
              </div>

              <div className="rounded-2xl border border-dashed border-white/12 bg-black/10 p-4 text-center sm:p-6">
                <Label htmlFor="photos" className="flex cursor-pointer flex-col items-center">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                    {compressing ? <Minimize2 className="animate-pulse" size={23} /> : <ImagePlus size={23} />}
                  </span>
                  <span className="mt-3 text-sm font-medium text-white">
                    {compressing ? "Optimizing photos..." : "Choose vehicle photos"}
                  </span>
                  <span className="mt-1 text-xs text-slate-600">
                    Up to 8 images · automatically compressed before upload
                  </span>
                </Label>
                <Input
                  id="photos"
                  type="file"
                  multiple
                  accept="image/*"
                  disabled={compressing || uploading}
                  onChange={(event) => void handlePhotoUpload(event)}
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

                  <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-300/10 bg-emerald-300/[0.045] px-3 py-2 text-[10px]">
                    <span className="flex items-center gap-1.5 text-emerald-300/80">
                      <Minimize2 size={12} /> Optimized for mobile upload
                    </span>
                    <span className="text-slate-500">
                      {formatFileSize(originalTotalBytes)} → {formatFileSize(optimizedTotalBytes)}
                    </span>
                  </div>
                </div>
              )}

              <Button
                type="button"
                onClick={handleSavePhotos}
                disabled={photos.length === 0 || uploading || compressing || !userId}
                className="mt-5 h-11 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 font-semibold text-slate-950 hover:from-cyan-300 hover:to-blue-400"
              >
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                    Uploading report...
                  </span>
                ) : compressing ? (
                  "Optimizing photos..."
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
        </div>
      )}
    </AppPage>
  );
}
