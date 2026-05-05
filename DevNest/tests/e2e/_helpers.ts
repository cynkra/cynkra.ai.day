import { expect, type APIRequestContext, type Page } from "@playwright/test";

const MAILHOG_API = "http://localhost:8025/api/v2";

export type MailhogMessage = {
  ID: string;
  Content: { Headers: { To: string[]; Subject: string[] }; Body: string };
  Created: string;
};

export async function waitForEmailTo(
  request: APIRequestContext,
  email: string,
  timeoutMs = 15_000,
): Promise<MailhogMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await request.get(`${MAILHOG_API}/messages`);
    if (res.ok()) {
      const body = (await res.json()) as { items: MailhogMessage[] };
      const match = body.items?.find((m) =>
        m.Content.Headers.To?.some((to) => to.toLowerCase() === email.toLowerCase()),
      );
      if (match) return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No email to ${email} arrived within ${timeoutMs}ms`);
}

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

export function extractMagicLink(message: MailhogMessage): string {
  const body = decodeQuotedPrintable(message.Content.Body);
  const match = body.match(
    /https?:\/\/[^\s"<>]*\/api\/auth\/callback\/[^\s"<>]+/,
  );
  if (!match) {
    throw new Error(`Could not find a callback URL in email body:\n${body}`);
  }
  return match[0];
}

/**
 * Sign in via magic-link. Useful for any e2e that needs an authenticated
 * page. Returns the email used so callers can correlate later messages.
 */
export async function signInViaMagicLink(
  page: Page,
  request: APIRequestContext,
  workerIndex: number,
): Promise<{ email: string }> {
  const email = `e2e-${workerIndex}-${Date.now()}@e2e.devnest.local`;
  await page.goto("/signin");
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole("button", { name: /send magic link/i }).click();
  await expect(
    page.getByRole("heading", { name: /check your email/i }),
  ).toBeVisible();
  const message = await waitForEmailTo(request, email);
  const magicLink = extractMagicLink(message);
  await page.goto(magicLink);
  return { email };
}
