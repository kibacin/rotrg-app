"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarDays, CarFront, CircleDollarSign, Gauge, Plus, Search, Trash2, Wrench } from "lucide-react";
import { AppPage, LoadingScreen, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/app/lib/authFunctions";
import { supabase } from "@/app/lib/supabaseClient";

type Car = { id: number; name: string; plate: string; year: number };
type ServiceReport = {
  id: string;
  car_id: number;
  admin_id: string;
  service_date: string;
  provider: string | null;
  odometer_km: number | null;
  issue_description: string;
  work_performed: string;
  notes: string | null;
  cost_eur: number | null;
  created_at: string;
  cars: { name: string; plate: string } | null;
  drivers: { full_name: string } | null;
};

async function authorizedFetch(options: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Your session expired. Please sign in again.");
  return fetch("/api/admin/fleet", {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
  });
}

export default function ServicesPage() {
  const router = useRouter();
  const [cars, setCars] = useState<Car[]>([]);
  const [reports, setReports] = useState<ServiceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCar, setSavingCar] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [carName, setCarName] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [carYear, setCarYear] = useState(String(new Date().getFullYear()));
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);
  const [serviceDate, setServiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [provider, setProvider] = useState("");
  const [odometerKm, setOdometerKm] = useState("");
  const [costEur, setCostEur] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [workPerformed, setWorkPerformed] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");

  const loadFleet = async () => {
    const [carsResult, reportsResult] = await Promise.all([
      supabase.from("cars").select("id, name, plate, year").order("name"),
      supabase
        .from("vehicle_service_reports")
        .select("id, car_id, admin_id, service_date, provider, odometer_km, issue_description, work_performed, notes, cost_eur, created_at, cars(name, plate), drivers(full_name)")
        .order("service_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    if (carsResult.error) throw carsResult.error;
    if (reportsResult.error) throw reportsResult.error;
    const loadedCars = (carsResult.data ?? []) as Car[];
    setCars(loadedCars);
    setSelectedCarId((current) => current ?? loadedCars[0]?.id ?? null);
    setReports((reportsResult.data ?? []) as unknown as ServiceReport[]);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { user } = await getCurrentUser();
      if (!user) {
        router.replace("/");
        return;
      }
      const { data: profile } = await supabase.from("drivers").select("role, active").eq("id", user.id).maybeSingle();
      if (profile?.role !== "admin" || profile.active === false) {
        router.replace("/home");
        return;
      }
      await loadFleet();
      if (active) setLoading(false);
    };
    void load().catch((error) => {
      console.error("Could not load service history:", error);
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [router]);

  const filteredReports = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return reports.filter((report) => {
      if (selectedCarId && report.car_id !== selectedCarId) return false;
      return !query
        || report.issue_description.toLocaleLowerCase().includes(query)
        || report.work_performed.toLocaleLowerCase().includes(query)
        || report.provider?.toLocaleLowerCase().includes(query);
    });
  }, [reports, search, selectedCarId]);

  const addCar = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingCar(true);
    try {
      const response = await authorizedFetch({
        method: "POST",
        body: JSON.stringify({ action: "add_car", name: carName, plate: carPlate, year: Number(carYear) }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "The vehicle could not be added");
      setCarName("");
      setCarPlate("");
      setSelectedCarId(result.car.id);
      await loadFleet();
    } catch (error) {
      alert(error instanceof Error ? error.message : "The vehicle could not be added");
    } finally {
      setSavingCar(false);
    }
  };

  const addReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCarId) return;
    setSavingReport(true);
    try {
      const response = await authorizedFetch({
        method: "POST",
        body: JSON.stringify({
          action: "add_service_report",
          carId: selectedCarId,
          serviceDate,
          provider,
          odometerKm,
          costEur,
          issueDescription,
          workPerformed,
          notes,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "The service report could not be saved");
      setProvider("");
      setOdometerKm("");
      setCostEur("");
      setIssueDescription("");
      setWorkPerformed("");
      setNotes("");
      await loadFleet();
    } catch (error) {
      alert(error instanceof Error ? error.message : "The service report could not be saved");
    } finally {
      setSavingReport(false);
    }
  };

  const deleteReport = async (report: ServiceReport) => {
    if (!confirm("Delete this service report?")) return;
    setDeletingId(report.id);
    try {
      const response = await authorizedFetch({ method: "DELETE", body: JSON.stringify({ reportId: report.id }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "The service report could not be deleted");
      setReports((current) => current.filter((item) => item.id !== report.id));
    } catch (error) {
      alert(error instanceof Error ? error.message : "The service report could not be deleted");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <LoadingScreen label="Loading fleet service history..." />;

  const selectedCar = cars.find((car) => car.id === selectedCarId) ?? null;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Fleet maintenance"
        title="Vehicles & service"
        description="Add vehicles and keep a complete record of faults, repairs and maintenance."
        icon={Wrench}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-white/8 bg-white/[0.03] py-0">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-300"><CarFront size={19} /></div>
              <div><h2 className="font-semibold text-white">Add vehicle</h2><p className="text-xs text-slate-500">The vehicle immediately appears in schedules and reports.</p></div>
            </div>
            <form onSubmit={addCar} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="car-name" className="text-xs text-slate-400">Vehicle</Label><Input id="car-name" value={carName} onChange={(event) => setCarName(event.target.value)} required placeholder="Peugeot 3008" className="h-11 rounded-xl border-white/10 bg-black/10 text-white" /></div>
                <div className="space-y-1.5"><Label htmlFor="car-plate" className="text-xs text-slate-400">Plate</Label><Input id="car-plate" value={carPlate} onChange={(event) => setCarPlate(event.target.value)} required placeholder="LJ AB-123" className="h-11 rounded-xl border-white/10 bg-black/10 uppercase text-white" /></div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="car-year" className="text-xs text-slate-400">Year</Label><Input id="car-year" type="number" min="1980" max="2100" value={carYear} onChange={(event) => setCarYear(event.target.value)} required className="h-11 rounded-xl border-white/10 bg-black/10 text-white" /></div>
              <Button type="submit" disabled={savingCar} className="h-11 w-full rounded-xl bg-cyan-300 font-semibold text-slate-950 hover:bg-cyan-200"><Plus size={17} /> {savingCar ? "Adding..." : "Add vehicle"}</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border border-cyan-300/12 bg-gradient-to-br from-cyan-300/[0.055] to-white/[0.025] py-0">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300"><Wrench size={19} /></div>
              <div><h2 className="font-semibold text-white">New service report</h2><p className="text-xs text-slate-500">Record what was wrong and what the service repaired.</p></div>
            </div>
            {cars.length === 0 ? (
              <p className="rounded-xl border border-white/8 bg-black/10 p-8 text-center text-sm text-slate-500">Add a vehicle first.</p>
            ) : (
              <form onSubmit={addReport} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor="service-car" className="text-xs text-slate-400">Vehicle</Label><select id="service-car" value={selectedCarId ?? ""} onChange={(event) => setSelectedCarId(Number(event.target.value))} className="h-11 w-full rounded-xl border border-white/10 bg-[#0c1420] px-3 text-sm text-white outline-none">{cars.map((car) => <option key={car.id} value={car.id}>{car.name} · {car.plate}</option>)}</select></div>
                  <div className="space-y-1.5"><Label htmlFor="service-date" className="text-xs text-slate-400">Service date</Label><Input id="service-date" type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} required className="h-11 rounded-xl border-white/10 bg-black/10 text-white" /></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5"><Label htmlFor="provider" className="text-xs text-slate-400">Workshop</Label><Input id="provider" value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Optional" className="h-11 rounded-xl border-white/10 bg-black/10 text-white" /></div>
                  <div className="space-y-1.5"><Label htmlFor="odometer" className="text-xs text-slate-400">Kilometres</Label><Input id="odometer" type="number" min="0" value={odometerKm} onChange={(event) => setOdometerKm(event.target.value)} placeholder="Optional" className="h-11 rounded-xl border-white/10 bg-black/10 text-white" /></div>
                  <div className="space-y-1.5"><Label htmlFor="cost" className="text-xs text-slate-400">Cost €</Label><Input id="cost" type="number" min="0" step="0.01" value={costEur} onChange={(event) => setCostEur(event.target.value)} placeholder="Optional" className="h-11 rounded-xl border-white/10 bg-black/10 text-white" /></div>
                </div>
                <div className="space-y-1.5"><Label htmlFor="issue" className="text-xs text-slate-400">Problem / reason for service</Label><Textarea id="issue" value={issueDescription} onChange={(event) => setIssueDescription(event.target.value)} required rows={3} placeholder="What was wrong or why the vehicle went to service?" className="resize-none rounded-xl border-white/10 bg-black/10 text-white" /></div>
                <div className="space-y-1.5"><Label htmlFor="work" className="text-xs text-slate-400">Work performed</Label><Textarea id="work" value={workPerformed} onChange={(event) => setWorkPerformed(event.target.value)} required rows={3} placeholder="What was repaired, replaced or checked?" className="resize-none rounded-xl border-white/10 bg-black/10 text-white" /></div>
                <div className="space-y-1.5"><Label htmlFor="notes" className="text-xs text-slate-400">Additional notes</Label><Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Condition after service, next check, warranty..." className="resize-none rounded-xl border-white/10 bg-black/10 text-white" /></div>
                <Button type="submit" disabled={savingReport} className="h-11 w-full rounded-xl bg-gradient-to-r from-amber-300 to-orange-400 font-semibold text-slate-950"><Wrench size={17} /> {savingReport ? "Saving..." : "Save service report"}</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold text-white">Service history</h2><p className="mt-0.5 text-xs text-slate-500">{selectedCar ? `${selectedCar.name} · ${selectedCar.plate}` : "Choose a vehicle"}</p></div>
          <label className="relative sm:w-72"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reports..." className="h-10 rounded-xl border-white/10 bg-black/10 pl-9 text-white" /></label>
        </div>

        <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {cars.map((car) => <button key={car.id} type="button" onClick={() => setSelectedCarId(car.id)} className={`min-w-40 rounded-2xl border p-3 text-left transition ${selectedCarId === car.id ? "border-cyan-300/25 bg-cyan-300/10" : "border-white/8 bg-white/[0.03]"}`}><CarFront size={17} className={selectedCarId === car.id ? "text-cyan-300" : "text-slate-600"} /><p className="mt-2 truncate text-sm font-semibold text-white">{car.name}</p><p className="text-xs text-slate-600">{car.plate} · {car.year}</p></button>)}
        </div>

        {filteredReports.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] py-14 text-center"><Wrench size={34} className="mx-auto mb-3 text-slate-700" /><p className="text-sm text-slate-500">No service reports for this vehicle.</p></div>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((report) => (
              <Card key={report.id} className="border border-white/8 bg-white/[0.03] py-0">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300"><Wrench size={19} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><p className="font-semibold text-white">{report.cars?.name || selectedCar?.name}</p><span className="flex items-center gap-1 text-xs text-slate-500"><CalendarDays size={12} /> {new Date(`${report.service_date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}</span></div>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-rose-300/75">Problem / reason</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">{report.issue_description}</p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-emerald-300/75">Work performed</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">{report.work_performed}</p>
                      {report.notes && <><p className="mt-3 text-xs font-semibold uppercase tracking-wider text-cyan-300/70">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-400">{report.notes}</p></>}
                      <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-slate-500">
                        {report.provider && <span className="rounded-full bg-white/5 px-2.5 py-1">{report.provider}</span>}
                        {report.odometer_km !== null && <span className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1"><Gauge size={11} /> {report.odometer_km.toLocaleString()} km</span>}
                        {report.cost_eur !== null && <span className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1"><CircleDollarSign size={11} /> €{Number(report.cost_eur).toFixed(2)}</span>}
                        <span className="rounded-full bg-white/5 px-2.5 py-1">Added by {report.drivers?.full_name || "admin"}</span>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" disabled={deletingId !== null} onClick={() => void deleteReport(report)} aria-label="Delete service report" className="shrink-0 rounded-xl text-slate-600 hover:bg-red-400/10 hover:text-red-300"><Trash2 /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </AppPage>
  );
}

