"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, KeyRound, Search, Trash2, UserPlus, UserRoundCheck, Users, X } from "lucide-react";
import { AppPage, LoadingScreen, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "@/app/lib/authFunctions";
import { supabase } from "@/app/lib/supabaseClient";

type Driver = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  active: boolean;
  created_at: string;
};

function generatePassword() {
  const random = crypto.getRandomValues(new Uint32Array(2));
  return `Rotrg.${random[0].toString(36)}${random[1].toString(36).slice(0, 4)}!`;
}

async function authorizedFetch(url: string, options: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Your session expired. Please sign in again.");

  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(options.headers || {}),
    },
  });
}

export default function DriverManagementPage() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyDriverId, setBusyDriverId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  const loadDrivers = async () => {
    const { data, error } = await supabase
      .from("drivers")
      .select("id, email, full_name, role, active, created_at")
      .neq("role", "admin")
      .order("active", { ascending: false })
      .order("full_name");
    if (error) throw error;
    setDrivers((data ?? []) as Driver[]);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { user } = await getCurrentUser();
      if (!user) {
        router.replace("/");
        return;
      }

      const { data: profile } = await supabase
        .from("drivers")
        .select("role, active")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role !== "admin" || profile.active === false) {
        router.replace("/home");
        return;
      }

      await loadDrivers();
      if (active) setLoading(false);
    };

    void load().catch((error) => {
      console.error("Could not load drivers:", error);
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [router]);

  const filteredDrivers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return drivers.filter((driver) => {
      if (!showInactive && !driver.active) return false;
      return !query
        || driver.full_name.toLocaleLowerCase().includes(query)
        || driver.email.toLocaleLowerCase().includes(query);
    });
  }, [drivers, search, showInactive]);

  const createDriver = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const credentials = { email: email.trim().toLowerCase(), password };

    try {
      const response = await authorizedFetch("/api/admin/drivers", {
        method: "POST",
        body: JSON.stringify({ fullName, email, password }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "The driver could not be created");

      setCreatedCredentials(credentials);
      setFullName("");
      setEmail("");
      setPassword(generatePassword());
      await loadDrivers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "The driver could not be created");
    } finally {
      setSaving(false);
    }
  };

  const reactivateDriver = async (driver: Driver) => {
    setBusyDriverId(driver.id);
    try {
      const response = await authorizedFetch("/api/admin/drivers", {
        method: "PATCH",
        body: JSON.stringify({ driverId: driver.id, active: true }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not reactivate driver");
      setDrivers((current) => current.map((item) => item.id === driver.id ? { ...item, active: true } : item));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not reactivate driver");
    } finally {
      setBusyDriverId(null);
    }
  };

  const removeDriver = async (driver: Driver) => {
    if (!confirm(`Remove ${driver.full_name}? Sign-in will be disabled, while historical schedules, receipts and reports stay preserved.`)) return;

    setBusyDriverId(driver.id);
    try {
      const response = await authorizedFetch("/api/admin/drivers", {
        method: "DELETE",
        body: JSON.stringify({ driverId: driver.id }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not remove driver");
      setDrivers((current) => current.map((item) => item.id === driver.id ? { ...item, active: false } : item));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not remove driver");
    } finally {
      setBusyDriverId(null);
    }
  };

  if (loading) return <LoadingScreen label="Loading driver accounts..." />;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Administration"
        title="Driver accounts"
        description="Create driver logins and remove or restore access. Historical records stay preserved."
        icon={Users}
      />

      <Card className="border border-cyan-300/12 bg-gradient-to-br from-cyan-300/[0.055] to-white/[0.025] py-0">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-300">
              <UserPlus size={21} />
            </div>
            <div>
              <h2 className="font-semibold text-white">Add a driver</h2>
              <p className="mt-0.5 text-xs text-slate-500">The account is confirmed immediately and can sign in with this password.</p>
            </div>
          </div>

          <form onSubmit={createDriver} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="driver-name" className="text-xs text-slate-400">Full name</Label>
              <Input id="driver-name" value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={120} placeholder="Driver name" className="h-11 rounded-xl border-white/10 bg-black/10 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="driver-email" className="text-xs text-slate-400">Email</Label>
              <Input id="driver-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="name@rotrg.com" className="h-11 rounded-xl border-white/10 bg-black/10 text-white" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="driver-password" className="text-xs text-slate-400">Temporary password</Label>
              <div className="flex gap-2">
                <Input id="driver-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} className="h-11 rounded-xl border-white/10 bg-black/10 font-mono text-white" />
                <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())} className="h-11 shrink-0 rounded-xl border-white/10 bg-white/[0.03] text-xs text-slate-300">
                  <KeyRound size={15} /> Generate
                </Button>
              </div>
            </div>
            <Button type="submit" disabled={saving} className="h-11 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 font-semibold text-slate-950 sm:col-span-2">
              {saving ? "Creating account..." : <><UserPlus size={17} /> Create driver account</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      {createdCredentials && (
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-emerald-300" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Driver account created</p>
              <p className="mt-1 break-all font-mono text-xs text-emerald-200">{createdCredentials.email} · {createdCredentials.password}</p>
              <p className="mt-1 text-[10px] text-slate-500">Copy these details now and send them to the driver securely.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => void navigator.clipboard.writeText(`${createdCredentials.email}\n${createdCredentials.password}`)} aria-label="Copy credentials" className="rounded-xl text-emerald-300 hover:bg-emerald-300/10">
              <Copy />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => setCreatedCredentials(null)} aria-label="Close credentials" className="rounded-xl text-slate-500 hover:bg-white/5">
              <X />
            </Button>
          </div>
        </div>
      )}

      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-white">Drivers</h2>
            <p className="mt-0.5 text-xs text-slate-500">{drivers.filter((driver) => driver.active).length} active accounts</p>
          </div>
          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1 sm:w-64">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search drivers..." className="h-10 rounded-xl border-white/10 bg-black/10 pl-9 text-white" />
            </label>
            <Button type="button" variant="outline" onClick={() => setShowInactive((value) => !value)} className={`h-10 rounded-xl border-white/10 text-xs ${showInactive ? "bg-cyan-300/10 text-cyan-300" : "bg-white/[0.03] text-slate-400"}`}>
              {showInactive ? "Hide inactive" : "Show inactive"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {filteredDrivers.map((driver) => (
            <Card key={driver.id} className={`border py-0 ${driver.active ? "border-white/8 bg-white/[0.03]" : "border-red-300/10 bg-red-300/[0.025] opacity-70"}`}>
              <CardContent className="flex items-center gap-3 p-3.5 sm:p-4">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${driver.active ? "bg-cyan-300/10 text-cyan-300" : "bg-white/5 text-slate-600"}`}>
                  {driver.active ? <UserRoundCheck size={19} /> : <Trash2 size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{driver.full_name}</p>
                  <p className="truncate text-xs text-slate-600">{driver.email}</p>
                </div>
                {driver.active ? (
                  <Button type="button" variant="ghost" disabled={busyDriverId !== null} onClick={() => void removeDriver(driver)} className="rounded-xl text-xs text-slate-500 hover:bg-red-400/10 hover:text-red-300">
                    <Trash2 size={15} /> Remove
                  </Button>
                ) : (
                  <Button type="button" variant="outline" disabled={busyDriverId !== null} onClick={() => void reactivateDriver(driver)} className="rounded-xl border-emerald-300/15 bg-emerald-300/[0.05] text-xs text-emerald-300 hover:bg-emerald-300/10">
                    <UserRoundCheck size={15} /> Reactivate
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          {filteredDrivers.length === 0 && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] py-12 text-center text-sm text-slate-500">No drivers match this view.</div>
          )}
        </div>
      </section>
    </AppPage>
  );
}
