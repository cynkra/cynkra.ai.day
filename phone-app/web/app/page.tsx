import { SCHEMA_VERSION, ENRICHMENT_MODES } from '@phone-app/shared';

export default function Home() {
  return (
    <main style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <h1>Phone App</h1>
      <p>
        Backend payloads use schema version <code>{SCHEMA_VERSION}</code>.
      </p>
      <p>
        Cards support enrichment modes: <code>{ENRICHMENT_MODES.join(', ')}</code>.
      </p>
      <p>
        <em>
          Setup-on-iPhone, library, review, and AI deck generation will live here as the PWA work in{' '}
          <code>pivot-to-pwa-shortcut</code> sections 4-5 lands.
        </em>
      </p>
    </main>
  );
}
