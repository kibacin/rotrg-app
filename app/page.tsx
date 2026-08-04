"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "./lib/authFunctions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, CarFront, LockKeyhole, ShieldCheck } from "lucide-react";

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
      setError("Incorrect email or password.");
      setLoading(false);
      return;
    }

    router.replace("/home");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-8">
      <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />

      <Card className="relative w-full max-w-md overflow-hidden border border-white/10 bg-[#0d1521]/85 py-0 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="h-1 bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-500" />

        <CardHeader className="space-y-5 px-6 pb-4 pt-8 text-center sm:px-8">
          <div className="relative mx-auto">
            <div className="absolute inset-0 rounded-3xl bg-cyan-300/25 blur-2xl" />
            <div className="relative flex size-20 items-center justify-center rounded-3xl border border-cyan-200/20 bg-gradient-to-br from-cyan-400/25 to-blue-600/25 shadow-[0_16px_40px_rgba(34,211,238,0.15)]">
              <CarFront className="text-cyan-200" size={36} strokeWidth={1.7} />
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300/70">Fleet workspace</p>
            <CardTitle className="text-3xl font-semibold tracking-tight text-white">
            ROTRG Taxi
            </CardTitle>
            <CardDescription className="mt-2 text-sm text-slate-400">
              Sign in to manage your daily work.
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="px-6 pb-8 sm:px-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-300">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="driver@rotrg.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl border-white/10 bg-white/[0.04] px-4 text-white placeholder:text-slate-600 focus-visible:border-cyan-300/40 focus-visible:ring-cyan-300/10"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-sm font-medium text-slate-300">
                  Password
                </Label>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 rounded-xl border-white/10 bg-white/[0.04] px-4 text-white placeholder:text-slate-600 focus-visible:border-cyan-300/40 focus-visible:ring-cyan-300/10"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2.5 text-center text-sm text-red-300">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-base font-semibold text-slate-950 shadow-[0_12px_32px_rgba(34,211,238,0.18)] hover:from-cyan-300 hover:to-blue-400"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">Sign in <ArrowRight size={17} /></span>
              )}
            </Button>

            <div className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-500">
              <ShieldCheck size={14} className="text-emerald-400/70" />
              Secure access to the ROTRG workspace
              <LockKeyhole size={12} />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
