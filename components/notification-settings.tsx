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
    throw new Error("No active session");
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
    throw new Error(result?.error || "The notification subscription could not be saved");
  }
}

export function NotificationSettings() {
  const [status, setStatus] = useState<NotificationStatus>("checking");
  const [message, setMessage] = useState("Checking notification status...");
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
          setMessage("This device does not support web notifications.");
        }
        return;
      }

      if (Notification.permission === "denied") {
        if (active) {
          setStatus("denied");
          setMessage("Notifications are blocked in your phone settings.");
        }
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();

      if (!subscription) {
        if (active) {
          setStatus("disabled");
          setMessage("Enable notifications so you do not miss admin updates.");
        }
        return;
      }

      if (active) {
        setStatus("enabled");
        setMessage("Notifications are active on this device.");
      }

      try {
        await saveSubscription(subscription);
      } catch (error) {
        console.error("Notification subscription sync failed:", error);
        if (active) {
          setStatus("error");
          setMessage("The phone is subscribed, but the server could not sync it.");
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
    setMessage("Enabling notifications...");

    try {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setStatus("unsupported");
        setMessage("This device does not support web notifications.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "disabled");
        setMessage(
          permission === "denied"
            ? "Notifications are blocked in your phone settings."
            : "Notification permission was not granted."
        );
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error("The public VAPID key is missing");
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
      setMessage("Notifications are active on this device.");
    } catch (error) {
      console.error("Could not enable notifications:", error);
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Notifications cannot be enabled right now."
      );
    } finally {
      setWorking(false);
    }
  };

  const enabled = status === "enabled";
  const blocked = status === "denied" || status === "unsupported";

  return (
    <Card className="border border-white/8 bg-white/[0.035] py-0">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              enabled
                ? "border border-emerald-300/15 bg-emerald-300/10 text-emerald-300"
                : "border border-violet-300/15 bg-violet-300/10 text-violet-300"
            }`}
          >
            {enabled ? <CheckCircle2 size={22} /> : blocked ? <BellOff size={22} /> : <Bell size={22} />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-medium text-white">Phone notifications</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{message}</p>
          </div>

          {!enabled && !blocked && (
            <Button
              type="button"
              size="sm"
              onClick={enableNotifications}
              disabled={working || status === "checking"}
              className="h-9 shrink-0 rounded-xl bg-violet-400 px-3 font-semibold text-slate-950 hover:bg-violet-300"
            >
              {working ? "Wait..." : "Enable"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
