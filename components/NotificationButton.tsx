"use client";

import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/app/lib/authFunctions';

export default function NotificationButton() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkSubscription = async () => {
      const { user } = await getCurrentUser();
      if (!user) return;
      setUserId(user.id);

      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            const subscription = await registration.pushManager.getSubscription();
            setIsSubscribed(!!subscription);
          }
        } catch (error) {
          console.error('Greška pri provjeri pretplate:', error);
        }
      }
    };

    checkSubscription();
  }, []);

  const subscribe = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Vaš browser ne podržava notifikacije');
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        alert('Service Worker nije registrovan');
        setLoading(false);
        return;
      }

      // Traži dozvolu za notifikacije
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Morate dozvoliti notifikacije');
        setLoading(false);
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        alert('VAPID public key nije podešen');
        setLoading(false);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });

      // Pošalji pretplatu na server
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });

      if (!response.ok) {
        throw new Error('Greška pri čuvanju pretplate');
      }

      setIsSubscribed(true);
      alert('✅ Notifikacije su omogućene!');
    } catch (error) {
      console.error('Greška pri pretplati:', error);
      alert('❌ Greška pri omogućavanju notifikacija');
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          
          // Obriši pretplatu iz baze
          await fetch('/api/subscribe', {
            method: 'DELETE',
          });
        }
      }
      setIsSubscribed(false);
      alert('✅ Notifikacije su isključene');
    } catch (error) {
      console.error('Greška pri odjavi:', error);
      alert('❌ Greška pri isključivanju notifikacija');
    } finally {
      setLoading(false);
    }
  };
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
console.log('🔑 VAPID public key:', publicKey);
  return (
    <Button
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={loading}
      className={`w-full ${isSubscribed ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
    >
      {loading ? (
        '⏳ Molimo sačekajte...'
      ) : isSubscribed ? (
        <>
          <BellOff className="mr-2 h-4 w-4" />
          Isključi notifikacije
        </>
      ) : (
        <>
          <Bell className="mr-2 h-4 w-4" />
          Uključi notifikacije
        </>
      )}
    </Button>
  );
}