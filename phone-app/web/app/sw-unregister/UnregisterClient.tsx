'use client';

import { useState } from 'react';

export function UnregisterClient() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'unsupported' | 'error'>(
    'idle',
  );
  const [detail, setDetail] = useState<string>('');

  async function unregister() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      setStatus('unsupported');
      return;
    }
    setStatus('running');
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys.filter((k) => k.startsWith('phone-app-')).map((k) => caches.delete(k)),
        );
      }
      setStatus('done');
      setDetail(`Unregistered ${regs.length} service worker(s) and cleared caches.`);
    } catch (err) {
      setStatus('error');
      setDetail(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={unregister}
        disabled={status === 'running'}
        style={{ padding: '0.75rem 1.25rem', fontSize: '1rem', cursor: 'pointer' }}
      >
        {status === 'running' ? 'Unregistering…' : 'Unregister service worker'}
      </button>
      {status === 'done' && <p style={{ marginTop: '1rem' }}>✓ {detail} Now hard-refresh.</p>}
      {status === 'unsupported' && (
        <p style={{ marginTop: '1rem' }}>This browser has no service-worker API. Nothing to do.</p>
      )}
      {status === 'error' && <p style={{ marginTop: '1rem', color: '#b00020' }}>Error: {detail}</p>}
    </div>
  );
}
