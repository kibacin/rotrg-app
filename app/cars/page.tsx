"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/authFunctions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Car, Upload, X } from "lucide-react";

type Car = {
  id: number;
  name: string;
  plate: string;
  year: number;
};

type CarPhoto = {
  id: number;
  car_id: number;
  photo_url: string;
  uploaded_at: string;
};

export default function CarsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCar, setSelectedCar] = useState<number | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<CarPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { user } = await getCurrentUser();
      if (user) setUserId(user.id);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchCars = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("cars")
        .select("*")
        .order("name");

      if (error) {
        console.error("❌ Greška:", error);
        setCars([]);
      } else {
        setCars(data || []);
      }
      setLoading(false);
    };

    fetchCars();
  }, []);

  useEffect(() => {
    const fetchPhotos = async () => {
      if (!selectedCar || !userId) {
        setExistingPhotos([]);
        return;
      }

      const { data, error } = await supabase
        .from("car_photos")
        .select("*")
        .eq("car_id", selectedCar)
        .eq("driver_id", userId);

      if (error) {
        console.error("❌ Greška:", error);
        setExistingPhotos([]);
      } else {
        setExistingPhotos(data || []);
      }
    };

    fetchPhotos();
  }, [selectedCar, userId]);

  const handleCarSelect = (carId: number) => {
    setSelectedCar(carId);
    setPhotos([]);
    setPhotoPreviews([]);
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      setPhotos(fileArray);
      const previews = fileArray.map(file => URL.createObjectURL(file));
      setPhotoPreviews(previews);
    }
  };

  const handleSavePhotos = async () => {
    if (!selectedCar || !userId || photos.length < 6) return;

    setUploading(true);
    try {
      const uploadedUrls = [];
      for (const photo of photos) {
        const fileExt = photo.name.split(".").pop();
        const fileName = `${selectedCar}-${Date.now()}.${fileExt}`;
        const filePath = `cars/${selectedCar}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("car-photos")
          .upload(filePath, photo);

        if (uploadError) throw new Error(uploadError.message);

        const { data: urlData } = supabase.storage
          .from("car-photos")
          .getPublicUrl(filePath);

        uploadedUrls.push(urlData.publicUrl);
      }

      const { error: dbError } = await supabase
        .from("car_photos")
        .insert(
          uploadedUrls.map(url => ({
            car_id: selectedCar,
            driver_id: userId,
            photo_url: url,
          }))
        );

      if (dbError) throw new Error(dbError.message);

      alert("✅ Slike su uspešno sačuvane!");
      
      setPhotos([]);
      setPhotoPreviews([]);
      
      const { data } = await supabase
        .from("car_photos")
        .select("*")
        .eq("car_id", selectedCar)
        .eq("driver_id", userId);
      
      setExistingPhotos(data || []);

    } catch (error: any) {
      alert(`❌ Greška: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
    const newPreviews = [...photoPreviews];
    newPreviews.splice(index, 1);
    setPhotoPreviews(newPreviews);
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-slate-400">
        <span className="inline-block animate-spin mr-2">⏳</span> Učitavam automobile...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Car className="text-blue-500" size={28} />
          Automobili
        </h1>
        <p className="text-slate-400 text-sm">Izaberite auto i dodajte slike</p>
      </div>

      {cars.length === 0 ? (
        <Card className="border-0 bg-[#12121a]/90 backdrop-blur-xl">
          <CardContent className="py-12 text-center text-slate-400">
            <Car className="mx-auto mb-3 text-slate-600" size={48} />
            <p>Nema automobila u bazi</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {cars.map((car) => (
            <Card 
              key={car.id} 
              className={`cursor-pointer border-0 bg-[#12121a]/90 backdrop-blur-xl transition-all duration-200 ${
                selectedCar === car.id ? "ring-2 ring-blue-600 shadow-lg shadow-blue-600/20" : "hover:bg-[#1a1a28]/90"
              }`}
              onClick={() => handleCarSelect(car.id)}
            >
              <CardHeader className="py-3">
                <CardTitle className="text-white text-lg">{car.name}</CardTitle>
                <p className="text-slate-400 text-sm">{car.plate} • {car.year}</p>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {selectedCar && (
        <Card className="border-0 bg-[#12121a]/90 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Camera size={20} className="text-blue-500" />
              Dodaj slike
            </CardTitle>
            <p className="text-slate-400 text-sm">Poslikajte auto sa 6-8 strana</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {existingPhotos.length > 0 && (
              <div>
                <Label className="text-slate-300 text-sm">Već postavljene slike</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {existingPhotos.map((photo) => (
                    <img
                      key={photo.id}
                      src={photo.photo_url}
                      alt="Auto"
                      className="w-full h-24 object-cover rounded-lg border border-slate-700"
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="photos" className="text-slate-300 text-sm">
                Izaberite slike (6-8)
              </Label>
              <Input
                id="photos"
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
                className="mt-2 bg-[#1a1a24]/80 border-slate-700/50 text-white file:bg-blue-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-xl hover:file:bg-blue-700 transition-all"
              />
            </div>

            {photoPreviews.length > 0 && (
              <div>
                <Label className="text-slate-300 text-sm">
                  Nove slike: {photoPreviews.length}/8
                </Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {photoPreviews.map((preview, index) => (
                    <div key={index} className="relative">
                      <img
                        src={preview}
                        alt={`Slika ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-slate-700"
                      />
                      <button
                        onClick={() => removePhoto(index)}
                        className="absolute -top-1 -right-1 bg-red-600 rounded-full p-0.5 hover:bg-red-700 transition-all"
                      >
                        <X size={16} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-lg shadow-blue-600/20"
              onClick={handleSavePhotos}
              disabled={photos.length < 6 || uploading}
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Slanje slika...
                </span>
              ) : photos.length < 6 ? (
                `Potrebno je još ${6 - photos.length} slika`
              ) : (
                <span className="flex items-center gap-2">
                  <Upload size={18} />
                  Sačuvaj slike
                </span>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}