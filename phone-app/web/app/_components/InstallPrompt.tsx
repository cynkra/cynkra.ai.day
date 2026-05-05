'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'pwa-install-dismissed-v1';

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
  const isSafari = /^((?!chrome|crios|fxios|edgios).)*safari/i.test(ua);
  return isIos && isSafari;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari exposes `navigator.standalone`; other browsers use the matchMedia query.
  const navStandalone =
    'standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone;
  const mql = window.matchMedia?.('(display-mode: standalone)').matches;
  return Boolean(navStandalone || mql);
}

export function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIosSafari()) return;
    if (isStandalone()) return;
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    setShow(true);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <aside
      role="region"
      aria-label="Install on iPhone"
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '1rem',
        right: '1rem',
        padding: '1rem',
        background: '#ffffff',
        color: '#171717',
        border: '1px solid #d0d0d0',
        borderRadius: '0.75rem',
        boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
        fontSize: '0.95rem',
        lineHeight: 1.4,
        zIndex: 1000,
      }}
    >
      <strong>Install on iPhone</strong>
      <ol style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
        <li>
          Tap the <em>Share</em> icon in Safari.
        </li>
        <li>
          Choose <em>Add to Home Screen</em>.
        </li>
        <li>Open the app from your home screen.</li>
      </ol>
      <button
        type="button"
        onClick={dismiss}
        style={{
          marginTop: '0.75rem',
          padding: '0.5rem 0.9rem',
          background: '#171717',
          color: '#ffffff',
          border: 'none',
          borderRadius: '0.4rem',
          cursor: 'pointer',
        }}
      >
        Got it
      </button>
    </aside>
  );
}
