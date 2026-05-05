# anki-clip.shortcut

This folder hosts the iOS Apple Shortcut that captures shared text and posts it to the backend.

## What it does

When invoked from the iOS share sheet on any text selection, the Shortcut:

1. Receives the shared text.
2. POSTs to `<backend>/cards` with:
   - `Authorization: Token <pat>` (the user's personal access token, pasted at install time)
   - JSON body `{ id, source_text, source_url?, content_type: "text", schema_version: 1 }` where `id` is a fresh UUID generated inside the Shortcut and `source_url` is the share-sheet URL when present.
3. Shows an iOS notification: "Saved to flashcards" on `200`/`201`, or an error message on any other status.

The Shortcut is **write-only** — it does not read from the backend, and it does not maintain a local outbox. It requires connectivity at the moment of capture.

## Where to get it

End users download the file via the PWA's `/settings/iphone` page (`Download Shortcut` link). The link points to `/shortcuts/anki-clip.shortcut`, served as a static asset.

> **The `.shortcut` binary is not yet committed.** It must be built once by hand on an iPhone or iPad in Apple's Shortcuts app and exported. See "Rebuild from scratch" below. Until that file is here, the download link 404s.

## Rebuild from scratch

If `anki-clip.shortcut` is missing, broken, or rejected by a newer iOS, recreate it on any iPhone or iPad in 60 seconds:

1. Open the **Shortcuts** app.
2. Tap **+** to create a new Shortcut. Name it `Clip to Flashcards`.
3. Tap the Shortcut's **(i)** info icon and enable **Show in Share Sheet**. Under **Share Sheet Types**, leave only **Text** selected.
4. Add the following actions in order. Each is added by searching its name in the action picker.

   | #   | Action                                          | Configuration                                                                                                                                                                                                                                                                                          |
   | --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | 1   | **Receive Input**                               | (auto-added) Configure to accept "Text" from the share sheet.                                                                                                                                                                                                                                          |
   | 2   | **Text**                                        | Paste your token here once. Suggestion: prefix with `pat_` since that's what the backend issues. This stores it inside the Shortcut.                                                                                                                                                                   |
   | 3   | **Set Variable**                                | Name: `Token`. Value: the **Text** result from step 2.                                                                                                                                                                                                                                                 |
   | 4   | **Text**                                        | Paste the backend URL (e.g. `https://api.your-domain.example` or `http://localhost:3000` for local dev).                                                                                                                                                                                               |
   | 5   | **Set Variable**                                | Name: `BackendURL`. Value: the **Text** result from step 4.                                                                                                                                                                                                                                            |
   | 6   | **UUID**                                        | Generates a UUID; we use it as the card's idempotency key.                                                                                                                                                                                                                                             |
   | 7   | **Set Variable**                                | Name: `CardId`. Value: the **UUID** result.                                                                                                                                                                                                                                                            |
   | 8   | **Get Current URL** _(optional)_                | Returns the URL of the page being shared, if any. Use only when the share-sheet input includes a URL alongside text.                                                                                                                                                                                   |
   | 9   | **Dictionary**                                  | Build a JSON object with these keys (use the `Variable` token-picker for non-literal values):<br>• `id` → `CardId`<br>• `source_text` → `Shortcut Input` (the shared text)<br>• `source_url` → URL from step 8 (or empty)<br>• `content_type` → literal text `text`<br>• `schema_version` → number `1` |
   | 10  | **Get Contents of URL**                         | URL: `BackendURL` joined with `/cards`. Method: `POST`. Headers: `Authorization` = `Token <Token>`, `Content-Type` = `application/json`. Request Body → JSON, body = the **Dictionary** from step 9.                                                                                                   |
   | 11  | **If**                                          | Get a `Status Code` from step 10 result (use the **Get Details of HTTP Response** action immediately after step 10 if Shortcuts does not expose the status directly). Condition: `Status Code` is `200` OR `201`.                                                                                      |
   | 12  | **Show Notification** (inside If branch)        | Title: `Saved to flashcards`. Body: the shared text (truncated).                                                                                                                                                                                                                                       |
   | 13  | **Otherwise**                                   |                                                                                                                                                                                                                                                                                                        |
   | 14  | **Show Notification** (inside Otherwise branch) | Title: `Capture failed`. Body: include the status code and the response body, e.g. `HTTP 401 — generate a new API token in the PhoneApp settings`.                                                                                                                                                     |
   | 15  | **End If**                                      |                                                                                                                                                                                                                                                                                                        |

5. Test the Shortcut: in any iPhone app, select some text → Share → tap **Clip to Flashcards** → confirm the success notification appears and the card shows up in the PWA.
6. Export: in the Shortcut's info pane, tap **Share Shortcut** → **Save to Files** → save as `anki-clip.shortcut` and commit it next to this README.

## Updating the Shortcut

If the API contract changes (new required field, new endpoint shape), update the Shortcut by hand and re-export. Bump `SCHEMA_VERSION` in `phone-app/shared/src/schema-version.ts` so older Shortcuts that still send the old version are rejected with `unsupported_schema_version`.

## Why this is hand-built and not generated

Apple's `.shortcut` file format is signed and undocumented. Hand-building once and committing the result is the trade-off chosen in `pivot-to-pwa-shortcut/design.md` (D1, D6).
