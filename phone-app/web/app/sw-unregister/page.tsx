import { UnregisterClient } from './UnregisterClient';

export const metadata = {
  title: 'Unregister service worker · PhoneApp',
};

export default function SwUnregisterPage() {
  return (
    <main style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <h1>Service worker kill-switch</h1>
      <p>
        If the PWA is stuck on an old version, this page unregisters the active service worker and
        clears the shell cache. Hard-refresh after running it.
      </p>
      <UnregisterClient />
    </main>
  );
}
