'use client';

import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: '0.5rem 1rem',
        background: '#fff3cd',
        color: '#664d03',
        borderBottom: '1px solid #ffe69c',
        textAlign: 'center',
        fontSize: '0.9rem',
      }}
    >
      You are offline. Changes you make are queued locally and will sync when connection returns.
    </div>
  );
}
