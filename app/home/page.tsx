"use client";

import { useRouter } from "next/navigation";
import { signOut } from "../lib/authFunctions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">🏠 Početna</h1>
      <p className="text-gray-600">Dobrodošli u ROTRG Taxi aplikaciju</p>
      
      <div className="grid grid-cols-1 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🚗 Automobili</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">Dodajte slike automobila</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📅 Raspored</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">Prijavite svoj raspored rada</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📢 Obaveštenja</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">Pregledajte obaveštenja</p>
          </CardContent>
        </Card>
      </div>

      <Button 
        onClick={handleLogout} 
        className="w-full bg-red-500 hover:bg-red-600"
      >
        Odjavi se
      </Button>
    </div>
  );
}