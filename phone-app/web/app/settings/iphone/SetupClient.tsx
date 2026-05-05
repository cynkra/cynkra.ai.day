'use client';

import { useCallback, useEffect, useState } from 'react';

interface TokenSummary {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface IssuedToken {
  id: string;
  name: string;
  raw_token: string;
  created_at: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BACKEND_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
}

export function SetupClient() {
  const [tokens, setTokens] = useState<TokenSummary[] | null>(null);
  const [authState, setAuthState] = useState<'loading' | 'signed-in' | 'signed-out' | 'error'>(
    'loading',
  );
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const [issuing, setIssuing] = useState<boolean>(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  const refresh = useCallback(async () => {
    try {
      const res = await api('/auth/tokens');
      if (res.status === 401) {
        setAuthState('signed-out');
        return;
      }
      if (!res.ok) {
        setAuthState('error');
        setErrorMsg(`HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as { tokens: TokenSummary[] };
      setTokens(body.tokens);
      setAuthState('signed-in');
    } catch (err) {
      setAuthState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleIssue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setIssuing(true);
    try {
      const res = await api('/auth/tokens', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        setErrorMsg(`Failed to issue token: HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as IssuedToken;
      setIssued(body);
      setName('');
      await refresh();
    } finally {
      setIssuing(false);
    }
  }

  async function handleRevoke(id: string) {
    const ok = window.confirm('Revoke this token? Any device using it will lose access.');
    if (!ok) return;
    const res = await api(`/auth/tokens/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      setErrorMsg(`Failed to revoke: HTTP ${res.status}`);
      return;
    }
    await refresh();
  }

  async function copyIssued() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.raw_token);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      // ignore; user can long-press to copy
    }
  }

  if (authState === 'loading') {
    return <p style={{ marginTop: '2rem' }}>Loading…</p>;
  }

  if (authState === 'signed-out') {
    return (
      <section style={{ marginTop: '2rem' }}>
        <h2>Sign in first</h2>
        <p>
          You need to be signed in to generate a token. Visit the home page and sign in, then return
          to this page.
        </p>
      </section>
    );
  }

  if (authState === 'error') {
    return (
      <p style={{ marginTop: '2rem', color: '#b00020' }}>
        Could not reach the backend ({errorMsg}). Confirm <code>NEXT_PUBLIC_BACKEND_URL</code> is
        set and the backend is running at <code>{BACKEND_URL}</code>.
      </p>
    );
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      <section>
        <h2>1. Generate API token</h2>
        {issued && (
          <div
            role="alert"
            style={{
              padding: '1rem',
              marginBottom: '1rem',
              border: '1px solid #d0d0d0',
              borderRadius: '0.5rem',
              background: '#f7f7f7',
            }}
          >
            <p>
              Your new token. <strong>Copy it now</strong> — you will not see it again.
            </p>
            <code style={{ display: 'block', wordBreak: 'break-all', padding: '0.5rem 0' }}>
              {issued.raw_token}
            </code>
            <button
              type="button"
              onClick={copyIssued}
              style={{ padding: '0.4rem 0.75rem', cursor: 'pointer' }}
            >
              {copyState === 'copied' ? '✓ Copied' : 'Copy to clipboard'}
            </button>{' '}
            <button
              type="button"
              onClick={() => setIssued(null)}
              style={{ padding: '0.4rem 0.75rem', cursor: 'pointer' }}
            >
              I copied it, hide
            </button>
          </div>
        )}
        <form onSubmit={handleIssue} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder='e.g. "iPhone 15"'
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ flex: 1, padding: '0.5rem', fontSize: '1rem' }}
          />
          <button
            type="submit"
            disabled={issuing || !name.trim()}
            style={{ padding: '0.5rem 1rem', cursor: issuing ? 'wait' : 'pointer' }}
          >
            {issuing ? 'Generating…' : 'Generate'}
          </button>
        </form>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>2. Download the Shortcut</h2>
        <p>
          <a href="/shortcuts/anki-clip.shortcut" download style={{ textDecoration: 'underline' }}>
            Download <code>anki-clip.shortcut</code>
          </a>
        </p>
        <p style={{ fontSize: '0.9rem', color: '#555' }}>
          On iPhone, tapping the link opens the Shortcuts app. Paste your token into the prompt when
          adding the Shortcut, then save. You will see it in the iOS share sheet on any text
          selection.
        </p>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>3. Existing tokens</h2>
        {tokens && tokens.length === 0 && <p>No tokens yet.</p>}
        {tokens && tokens.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #d0d0d0' }}>
                <th style={{ padding: '0.4rem 0.25rem' }}>Name</th>
                <th style={{ padding: '0.4rem 0.25rem' }}>Created</th>
                <th style={{ padding: '0.4rem 0.25rem' }}>Last used</th>
                <th style={{ padding: '0.4rem 0.25rem' }}>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #ececec' }}>
                  <td style={{ padding: '0.4rem 0.25rem' }}>{t.name}</td>
                  <td style={{ padding: '0.4rem 0.25rem' }}>
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '0.4rem 0.25rem' }}>
                    {t.last_used_at ? new Date(t.last_used_at).toLocaleString() : 'never'}
                  </td>
                  <td style={{ padding: '0.4rem 0.25rem' }}>
                    {t.revoked_at ? <span style={{ color: '#b00020' }}>revoked</span> : 'active'}
                  </td>
                  <td style={{ padding: '0.4rem 0.25rem', textAlign: 'right' }}>
                    {!t.revoked_at && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(t.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
