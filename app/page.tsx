"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "./lib/authFunctions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Car, Shield, Zap } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await signIn(email, password);

    if (error) {
      setError("Pogrešan email ili lozinka");
      setLoading(false);
      return;
    }

    router.push("/home");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      {/* Background efekat */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20 pointer-events-none" />
      
      <Card className="relative w-full max-w-md border-0 bg-[#12121a]/90 backdrop-blur-xl shadow-2xl shadow-black/80 overflow-hidden">
        {/* Glow linija na vrhu */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
        
        <CardHeader className="text-center space-y-4 pt-8">
          <div className="mx-auto relative">
            <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full" />
            <div className="relative bg-gradient-to-br from-blue-600 to-blue-800 w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Car className="text-white" size={36} />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-white tracking-tight">
            ROTRG Taxi
          </CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            Prijavite se za pristup sistemu
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300 text-sm font-medium">
                Email adresa
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="vozac@rotrg.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-[#1a1a24]/80 border-slate-700/50 text-white placeholder:text-slate-500 focus:ring-blue-600 focus:border-blue-600 transition-all rounded-xl"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-slate-300 text-sm font-medium">
                  Lozinka
                </Label>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 bg-[#1a1a24]/80 border-slate-700/50 text-white placeholder:text-slate-500 focus:ring-blue-600 focus:border-blue-600 transition-all rounded-xl"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center py-2 rounded-xl">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium shadow-lg shadow-blue-600/20 transition-all rounded-xl text-base"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Prijavljivanje...
                </span>
              ) : (
                "Prijavi se"
              )}
            </Button>

            <p className="text-center text-xs text-slate-500 pt-2">
              Siguran pristup • ROTRG Taxi sistem
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}