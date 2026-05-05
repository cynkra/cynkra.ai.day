'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const url = '/service-worker.js';
    navigator.serviceWorker.register(url).catch((err) => {
      console.warn('[phone-app] service worker registration failed', err);
    });
  }, []);

  return null;
}
