"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUser } from "../lib/authFunctions";

// Tipovi za automobile i slike
type Car = {
  id: number;
  name: string;
  plate: string;
  year: number;
};

type CarPhoto = {
  id: number;
  car_id: number;
  driver_id: string;
  photo_url: string;
  uploaded_at: string;
};

export default function CarsPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCar, setSelectedCar] = useState<number | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<CarPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Učitaj automobile iz baze
  useEffect(() => {
    const fetchCars = async () => {
       console.log("🔍 Pokušavam da učitam automobile...");
      const { data, error } = await supabase
        .from('cars')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Greška pri učitavanju automobila:', error);
      } else {
        setCars(data || []);
      }
    };

    fetchCars();
  }, []);

  // Učitaj postojeće slike za izabrani auto
  useEffect(() => {
    const fetchPhotos = async () => {
      if (!selectedCar) return;

      // Trenutno koristimo hardkodirani driver_id (kasnije ćemo dodati login)
      const { data, error } = await supabase
        .from('car_photos')
        .select('*')
        .eq('car_id', selectedCar)
        .eq('driver_id', 'be7c5e9f-2d7a-4f08-b606-eb62d12b579c'); // Zamenićemo sa pravim ID-jem

      if (error) {
        console.error('Greška pri učitavanju slika:', error);
      } else {
        setExistingPhotos(data || []);
      }
    };

    fetchPhotos();
  }, [selectedCar]);

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
      
      // Pravimo preview za prikaz
      const previews = fileArray.map(file => URL.createObjectURL(file));
      setPhotoPreviews(previews);
    }
  };

  const handleSavePhotos = async () => {
    if (!selectedCar || photos.length < 6) return;

    setUploading(true);
    try {
      // 1. Upload slika na Supabase Storage
      const uploadedUrls = [];
      for (const photo of photos) {
        const fileExt = photo.name.split('.').pop();
        const fileName = `${selectedCar}-${Date.now()}.${fileExt}`;
        const filePath = `cars/${selectedCar}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('car-photos')
          .upload(filePath, photo);

        if (uploadError) {
          throw new Error(`Greška pri upload-u: ${uploadError.message}`);
        }

        // Dobij URL slike
        const { data: urlData } = supabase.storage
          .from('car-photos')
          .getPublicUrl(filePath);

        uploadedUrls.push(urlData.publicUrl);
      }

      // 2. Sačuvaj URL-ove u bazu
      const { error: dbError } = await supabase
        .from('car_photos')
        .insert(
          uploadedUrls.map(url => ({
            car_id: selectedCar,
            driver_id: 'be7c5e9f-2d7a-4f08-b606-eb62d12b579c', // Zamenićemo sa pravim ID-jem
            photo_url: url,
          }))
        );

      if (dbError) {
        throw new Error(`Greška pri čuvanju u bazu: ${dbError.message}`);
      }

      alert('✅ Slike su uspešno sačuvane!');
      
      // Resetuj formu
      setPhotos([]);
      setPhotoPreviews([]);
      
      // Ponovo učitaj slike
      const { data } = await supabase
        .from('car_photos')
        .select('*')
        .eq('car_id', selectedCar)
        .eq('driver_id', 'test-driver-id');
      
      setExistingPhotos(data || []);

    } catch (error: any) {
      alert(`❌ Greška: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">🚗 Automobili</h1>
      <p className="text-gray-600">Izaberite auto i dodajte slike</p>

      {/* Lista automobila */}
      <div className="grid grid-cols-1 gap-3">
        {cars.map((car) => (
          <Card 
            key={car.id} 
            className={`cursor-pointer transition-all ${
              selectedCar === car.id ? "ring-2 ring-blue-500" : ""
            }`}
            onClick={() => handleCarSelect(car.id)}
          >
            <CardHeader className="py-3">
              <CardTitle className="text-lg">{car.name}</CardTitle>
              <CardDescription>
                {car.plate} • {car.year}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Upload slika */}
      {selectedCar && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📸 Dodaj slike</CardTitle>
            <CardDescription>
              Poslikajte auto sa 6-8 strana
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Postojeće slike */}
            {existingPhotos.length > 0 && (
              <div>
                <Label>Već postavljene slike</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {existingPhotos.map((photo) => (
                    <img
                      key={photo.id}
                      src={photo.photo_url}
                      alt="Auto"
                      className="w-full h-24 object-cover rounded-lg"
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="photos">Izaberite slike (6-8)</Label>
              <Input
                id="photos"
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
                className="mt-2"
              />
            </div>

            {/* Preview novih slika */}
            {photoPreviews.length > 0 && (
              <div>
                <Label>Nove slike: {photoPreviews.length}/8</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {photoPreviews.map((preview, index) => (
                    <img
                      key={index}
                      src={preview}
                      alt={`Slika ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                  ))}
                </div>
              </div>
            )}

            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={handleSavePhotos}
              disabled={photos.length < 6 || uploading}
            >
              {uploading 
                ? "⏳ Slanje slika..." 
                : photos.length < 6 
                  ? `Potrebno je još ${6 - photos.length} slika` 
                  : "✅ Sačuvaj slike"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}