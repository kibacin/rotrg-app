"use client";

import { useEffect } from 'react';

export default function SWRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      })
        .then(async (registration) => {
          await registration.update();
          console.log('✅ Service Worker registrovan:', registration);
        })
        .catch((error) => {
          console.log('Service worker registration failed:', error);
        });
    }
  }, []);

  return null;
}
