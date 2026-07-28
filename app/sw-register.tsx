"use client";

import { useEffect } from 'react';

export default function SWRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registrovan:', registration);
        })
        .catch((error) => {
          console.log('❌ Greška pri registraciji:', error);
        });
    }
  }, []);

  return null;
}