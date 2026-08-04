"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2 } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type NotificationStatus =
  | "checking"
  | "unsupported"
  | "disabled"
  | "denied"
  | "enabled"
  | "error";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

async function saveSubscription(subscription: PushSubscription) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Nema aktivne sesije");
  }

  const response = await fetch("/api/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error || "Pretplata nije sačuvana");
  }
}

export function NotificationSettings() {
  const [status, setStatus] = useState<NotificationStatus>("checking");
  const [message, setMessage] = useState("Provjeravam obavijesti...");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;

    const checkStatus = async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (active) {
          setStatus("unsupported");
          setMessage("Ovaj uređaj ne podržava web obavijesti.");
        }
        return;
      }

      if (Notification.permission === "denied") {
        if (active) {
          setStatus("denied");
          setMessage("Obavijesti su blokirane u postavkama telefona.");
        }
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();

      if (!subscription) {
        if (active) {
          setStatus("disabled");
          setMessage("Uključite obavijesti da ne propustite poruke admina.");
        }
        return;
      }

      if (active) {
        setStatus("enabled");
        setMessage("Obavijesti su uključene na ovom uređaju.");
      }

      try {
        await saveSubscription(subscription);
      } catch (error) {
        console.error("Greška pri sinhronizaciji pretplate:", error);
        if (active) {
          setStatus("error");
          setMessage("Telefon je pretplaćen, ali server nije sačuvao pretplatu.");
        }
      }
    };

    void checkStatus();

    return () => {
      active = false;
    };
  }, []);

  const enableNotifications = async () => {
    setWorking(true);
    setMessage("Uključujem obavijesti...");

    try {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setStatus("unsupported");
        setMessage("Ovaj uređaj ne podržava web obavijesti.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "disabled");
        setMessage(
          permission === "denied"
            ? "Obavijesti su blokirane u postavkama telefona."
            : "Dozvola za obavijesti nije odobrena."
        );
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error("Nedostaje javni VAPID ključ");
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      await saveSubscription(subscription);
      setStatus("enabled");
      setMessage("Obavijesti su uključene na ovom uređaju.");
    } catch (error) {
      console.error("Greška pri uključivanju obavijesti:", error);
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Obavijesti se trenutno ne mogu uključiti."
      );
    } finally {
      setWorking(false);
    }
  };

  const enabled = status === "enabled";
  const blocked = status === "denied" || status === "unsupported";

  return (
    <Card className="border-0 bg-[#12121a]/90 backdrop-blur-xl">
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              enabled
                ? "bg-emerald-600/20 text-emerald-400"
                : "bg-purple-600/20 text-purple-400"
            }`}
          >
            {enabled ? <CheckCircle2 size={22} /> : blocked ? <BellOff size={22} /> : <Bell size={22} />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-medium text-white">Obavijesti na telefonu</p>
            <p className="text-xs text-slate-400">{message}</p>
          </div>

          {!enabled && !blocked && (
            <Button
              type="button"
              size="sm"
              onClick={enableNotifications}
              disabled={working || status === "checking"}
              className="shrink-0 bg-purple-600 text-white hover:bg-purple-700"
            >
              {working ? "Čekaj..." : "Uključi"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
