"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Banknote,
  CalendarDays,
  Check,
  Fuel,
  ImagePlus,
  Minimize2,
  ReceiptText,
  Search,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { AppPage, LoadingScreen, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "../lib/authFunctions";
import { compressImage, formatFileSize } from "../lib/image";
import { supabase } from "../lib/supabaseClient";

type ReceiptType = "cash_ride" | "fuel";
type FuelType = "diesel" | "petrol";

type ReceiptRow = {
  id: string;
  driver_id: string;
  receipt_type: ReceiptType;
  fuel_type: FuelType | null;
  storage_path: string;
  created_at: string;
  drivers: { full_name: string; email: string } | null;
  signedUrl: string | null;
};

type ReceiptQueryRow = Omit<ReceiptRow, "signedUrl" | "drivers"> & {
  drivers:
    | { full_name: string; email: string }
    | Array<{ full_name: string; email: string }>
    | null;
};

const RECEIPT_BATCH_SIZE = 500;
const SIGNED_URL_BATCH_SIZE = 100;

function normalizeDriver(
  driver: ReceiptQueryRow["drivers"]
): ReceiptRow["drivers"] {
  return Array.isArray(driver) ? driver[0] ?? null : driver;
}

async function getReceiptRows(userId: string, isAdmin: boolean) {
  const rows: ReceiptQueryRow[] = [];

  for (let from = 0; ; from += RECEIPT_BATCH_SIZE) {
    let query = supabase
      .from("receipts")
      .select(`
        id,
        driver_id,
        receipt_type,
        fuel_type,
        storage_path,
        created_at,
        drivers(full_name, email)
      `)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .range(from, from + RECEIPT_BATCH_SIZE - 1);

    if (!isAdmin) query = query.eq("driver_id", userId);

    const { data, error } = await query;
    if (error) throw error;

    const batch = (data ?? []) as unknown as ReceiptQueryRow[];
    rows.push(...batch);
    if (batch.length < RECEIPT_BATCH_SIZE) break;
  }

  const signedUrlByPath = new Map<string, string>();
  const paths = rows.map((receipt) => receipt.storage_path);

  for (let index = 0; index < paths.length; index += SIGNED_URL_BATCH_SIZE) {
    const batchPaths = paths.slice(index, index + SIGNED_URL_BATCH_SIZE);
    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrls(batchPaths, 60 * 60);

    if (error) throw error;
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) {
        signedUrlByPath.set(item.path, item.signedUrl);
      }
    }
  }

  return rows.map((receipt): ReceiptRow => ({
    ...receipt,
    drivers: normalizeDriver(receipt.drivers),
    signedUrl: signedUrlByPath.get(receipt.storage_path) ?? null,
  }));
}

function getReceiptLabel(receipt: ReceiptRow) {
  if (receipt.receipt_type === "cash_ride") return "Cash ride";
  return receipt.fuel_type === "diesel" ? "Fuel · Diesel" : "Fuel · Petrol";
}

function ReceiptCard({
  receipt,
  isAdmin,
  onOpen,
}: {
  receipt: ReceiptRow;
  isAdmin: boolean;
  onOpen: () => void;
}) {
  const Icon = receipt.receipt_type === "cash_ride" ? Banknote : Fuel;

  return (
    <button type="button" onClick={onOpen} className="group text-left">
      <Card className="h-full overflow-hidden border border-white/8 bg-white/[0.03] py-0 transition hover:-translate-y-0.5 hover:border-cyan-300/20 hover:bg-white/[0.05]">
        <div className="relative aspect-[4/3] overflow-hidden bg-black/25">
          {receipt.signedUrl ? (
            <Image
              src={receipt.signedUrl}
              alt={`${getReceiptLabel(receipt)} receipt`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              unoptimized
              className="object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-700">
              <ReceiptText size={38} />
            </div>
          )}
          <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full border border-white/10 bg-[#07101b]/85 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
            <Icon size={12} className={receipt.receipt_type === "cash_ride" ? "text-emerald-300" : "text-amber-300"} />
            {getReceiptLabel(receipt)}
          </span>
        </div>
        <CardContent className="p-3.5 sm:p-4">
          {isAdmin && (
            <p className="truncate text-sm font-semibold text-white">
              {receipt.drivers?.full_name || "Unknown driver"}
            </p>
          )}
          <div className={`flex items-center justify-between gap-2 text-[11px] text-slate-500 ${isAdmin ? "mt-1.5" : ""}`}>
            {!isAdmin && <span className="font-medium text-slate-300">{getReceiptLabel(receipt)}</span>}
            <time dateTime={receipt.created_at} className="ml-auto shrink-0">
              {new Date(receipt.created_at).toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

export default function ReceiptsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [receiptType, setReceiptType] = useState<ReceiptType>("cash_ride");
  const [fuelType, setFuelType] = useState<FuelType>("diesel");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [originalBytes, setOriginalBytes] = useState(0);
  const [typeFilter, setTypeFilter] = useState<"all" | ReceiptType>("all");
  const [driverFilter, setDriverFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRow | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const loadReceipts = async (loadedUserId: string, admin: boolean) => {
    setReceipts(await getReceiptRows(loadedUserId, admin));
  };

  useEffect(() => {
    let active = true;

    const loadPage = async () => {
      const { user } = await getCurrentUser();
      if (!user) return;

      const { data: profile, error: profileError } = await supabase
        .from("drivers")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;
      const admin = profile?.role === "admin";
      const loadedReceipts = await getReceiptRows(user.id, admin);

      if (!active) return;
      setUserId(user.id);
      setIsAdmin(admin);
      setReceipts(loadedReceipts);
      setLoading(false);
    };

    void loadPage().catch((error) => {
      console.error("Could not load receipts:", error);
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const resetPhoto = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPhoto(null);
    setPhotoPreview(null);
    setOriginalBytes(0);
  };

  const handlePhotoSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedPhoto = event.target.files?.[0];
    event.target.value = "";
    if (!selectedPhoto) return;

    if (!selectedPhoto.type.startsWith("image/")) {
      alert("Please choose an image of the receipt.");
      return;
    }

    if (selectedPhoto.size > 25 * 1024 * 1024) {
      alert("This image is too large. Please choose an image smaller than 25 MB.");
      return;
    }

    setCompressing(true);
    setOriginalBytes(selectedPhoto.size);
    const optimizedPhoto = await compressImage(selectedPhoto, "receipt");
    setCompressing(false);

    if (optimizedPhoto.size > 10 * 1024 * 1024) {
      alert("The optimized image is still larger than 10 MB. Please take a new photo closer to the receipt.");
      return;
    }

    resetPhoto();
    const preview = URL.createObjectURL(optimizedPhoto);
    previewUrlRef.current = preview;
    setOriginalBytes(selectedPhoto.size);
    setPhoto(optimizedPhoto);
    setPhotoPreview(preview);
  };

  const handleUpload = async () => {
    if (!userId || !photo) return;

    setUploading(true);
    let storagePath: string | null = null;

    try {
      const extension = photo.type === "image/jpeg"
        ? "jpg"
        : (photo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const now = new Date();
      storagePath = `${userId}/${format(now, "yyyy/MM")}/${crypto.randomUUID()}.${extension || "jpg"}`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(storagePath, photo, {
          contentType: photo.type || "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: receiptError } = await supabase.from("receipts").insert({
        driver_id: userId,
        receipt_type: receiptType,
        fuel_type: receiptType === "fuel" ? fuelType : null,
        storage_path: storagePath,
      });

      if (receiptError) throw receiptError;

      resetPhoto();
      await loadReceipts(userId, isAdmin);
      alert("Receipt uploaded successfully.");
    } catch (error) {
      if (storagePath) {
        const { error: cleanupError } = await supabase.storage
          .from("receipts")
          .remove([storagePath]);
        if (cleanupError) {
          console.error("Could not clean up an incomplete receipt upload:", cleanupError);
        }
      }

      const message = error instanceof Error ? error.message : "The receipt could not be uploaded";
      alert(`Error: ${message}`);
    } finally {
      setUploading(false);
    }
  };

  const filteredReceipts = useMemo(() => {
    const normalizedDriverFilter = driverFilter.trim().toLocaleLowerCase();

    return receipts.filter((receipt) => {
      if (typeFilter !== "all" && receipt.receipt_type !== typeFilter) return false;
      if (dateFilter && format(new Date(receipt.created_at), "yyyy-MM-dd") !== dateFilter) return false;
      if (
        normalizedDriverFilter &&
        !receipt.drivers?.full_name.toLocaleLowerCase().includes(normalizedDriverFilter) &&
        !receipt.drivers?.email.toLocaleLowerCase().includes(normalizedDriverFilter)
      ) {
        return false;
      }
      return true;
    });
  }, [dateFilter, driverFilter, receipts, typeFilter]);

  if (loading) return <LoadingScreen label="Loading receipts..." />;

  return (
    <AppPage>
      <PageHeader
        eyebrow={isAdmin ? "Administration" : "Driver reports"}
        title="Receipts"
        description={
          isAdmin
            ? "Submit cash ride or fuel receipts and review every team submission."
            : "Send a cash ride or fuel receipt to the administrator."
        }
        icon={ReceiptText}
      />

      <Card className="border border-cyan-300/12 bg-gradient-to-br from-cyan-300/[0.055] to-white/[0.025] py-0">
        <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-2 gap-2.5">
              {([
                { value: "cash_ride" as const, label: "Cash ride", description: "Money ride receipt", icon: Banknote },
                { value: "fuel" as const, label: "Fuel", description: "Diesel or petrol", icon: Fuel },
              ]).map((option) => {
                const Icon = option.icon;
                const selected = receiptType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setReceiptType(option.value)}
                    disabled={uploading || compressing}
                    className={`relative rounded-2xl border p-3.5 text-left transition disabled:opacity-50 ${
                      selected
                        ? "border-cyan-300/30 bg-cyan-300/10"
                        : "border-white/8 bg-black/10 hover:border-white/15 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Icon size={21} className={selected ? "text-cyan-300" : "text-slate-500"} />
                      {selected && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-cyan-300 text-slate-950">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm font-semibold text-white">{option.label}</p>
                    <p className="mt-0.5 text-[10px] text-slate-600">{option.description}</p>
                  </button>
                );
              })}
            </div>

            {receiptType === "fuel" && (
              <div className="mt-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Fuel type
                </p>
                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/8 bg-black/10 p-1.5">
                  {(["diesel", "petrol"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      disabled={uploading || compressing}
                      onClick={() => setFuelType(value)}
                      className={`rounded-xl px-3 py-2.5 text-xs font-semibold capitalize transition ${
                        fuelType === value
                          ? "bg-amber-300 text-slate-950"
                          : "text-slate-500 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-dashed border-white/12 bg-black/10 p-4 text-center sm:p-6">
              {!photoPreview ? (
                <Label htmlFor="receipt-photo" className="flex cursor-pointer flex-col items-center">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                    {compressing ? <Minimize2 className="animate-pulse" size={23} /> : <ImagePlus size={23} />}
                  </span>
                  <span className="mt-3 text-sm font-medium text-white">
                    {compressing ? "Optimizing receipt..." : "Take or choose a receipt photo"}
                  </span>
                  <span className="mt-1 text-xs text-slate-600">
                    The image is compressed before upload
                  </span>
                </Label>
              ) : (
                <div>
                  <div className="relative mx-auto aspect-[4/3] max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                    <Image
                      src={photoPreview}
                      alt="Selected receipt"
                      fill
                      sizes="400px"
                      unoptimized
                      className="object-contain"
                    />
                    <button
                      type="button"
                      onClick={resetPhoto}
                      disabled={uploading}
                      aria-label="Remove receipt photo"
                      className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/75 text-white backdrop-blur hover:bg-red-500 disabled:opacity-50"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-emerald-300/75">
                    <Minimize2 size={12} />
                    {formatFileSize(originalBytes)} → {formatFileSize(photo?.size ?? 0)}
                  </p>
                </div>
              )}
              <Input
                id="receipt-photo"
                type="file"
                accept="image/*"
                capture="environment"
                disabled={uploading || compressing}
                onChange={(event) => void handlePhotoSelection(event)}
                className="sr-only"
              />
            </div>

            <Button
              type="button"
              onClick={() => void handleUpload()}
              disabled={!photo || uploading || compressing}
              className="mt-4 h-11 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 font-semibold text-slate-950 hover:from-cyan-300 hover:to-blue-400"
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900" />
                  Uploading receipt...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Upload size={17} /> Send receipt
                </span>
              )}
            </Button>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="border border-white/8 bg-white/[0.03] py-0">
          <CardContent className="p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <label className="relative block">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <Input
                  value={driverFilter}
                  onChange={(event) => setDriverFilter(event.target.value)}
                  placeholder="Search driver..."
                  className="h-10 rounded-xl border-white/10 bg-black/10 pl-9 text-white placeholder:text-slate-600"
                />
              </label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                aria-label="Filter receipts by date"
                className="h-10 rounded-xl border-white/10 bg-black/10 text-slate-300"
              />
              <div className="grid grid-cols-3 rounded-xl border border-white/8 bg-black/10 p-1">
                {(["all", "cash_ride", "fuel"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTypeFilter(value)}
                    className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition ${
                      typeFilter === value
                        ? "bg-cyan-300 text-slate-950"
                        : "text-slate-500 hover:text-white"
                    }`}
                  >
                    {value === "all" ? "All" : value === "cash_ride" ? "Cash" : "Fuel"}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">
              {isAdmin ? "Submitted receipts" : "Your recent receipts"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {isAdmin ? "Newest submissions appear first. Receipts are removed after 30 days." : "Use this list to confirm that your receipt was sent. Receipts are kept for 30 days."}
            </p>
          </div>
          <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-500">
            {filteredReceipts.length}
          </span>
        </div>

        {filteredReceipts.length === 0 ? (
          <Card className="border border-white/8 bg-white/[0.03] py-0">
            <CardContent className="py-16 text-center">
              <ReceiptText className="mx-auto mb-3 text-slate-700" size={38} />
              <p className="text-sm text-slate-500">
                {receipts.length === 0 ? "No receipts have been submitted yet." : "No receipts match these filters."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredReceipts.map((receipt) => (
              <ReceiptCard
                key={receipt.id}
                receipt={receipt}
                isAdmin={isAdmin}
                onOpen={() => setSelectedReceipt(receipt)}
              />
            ))}
          </div>
        )}
      </section>

      {selectedReceipt?.signedUrl && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d1521] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-300">
                  <ReceiptText size={18} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{getReceiptLabel(selectedReceipt)}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] text-slate-500">
                    {isAdmin ? <UserRound size={11} /> : <CalendarDays size={11} />}
                    {isAdmin
                      ? selectedReceipt.drivers?.full_name || "Unknown driver"
                      : new Date(selectedReceipt.created_at).toLocaleString("en-GB")}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSelectedReceipt(null)}
                aria-label="Close receipt"
                className="rounded-xl text-slate-500 hover:bg-white/5 hover:text-white"
              >
                <X />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
              <div className="relative flex min-h-72 items-center justify-center overflow-hidden rounded-2xl bg-black/35 sm:min-h-[560px]">
                <Image
                  src={selectedReceipt.signedUrl}
                  alt={`${getReceiptLabel(selectedReceipt)} receipt`}
                  width={1800}
                  height={1800}
                  unoptimized
                  className="max-h-[72vh] w-auto max-w-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </AppPage>
  );
}
