# Deployment

Two supported paths: **Vercel** (zero-config, recommended for the MVP)
and a generic Node host via the **production Dockerfile** in this repo.
CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) verifies
typecheck, lint, unit tests, migrations, build, and Playwright e2e on
every push and pull request.

## Branch protection (one-time, manual)

The CI workflow only catches issues if it's required to pass before
merge. Configure once via the GitHub repository UI:

1. **Repository → Settings → Branches → Add classic branch protection rule**
2. Branch name pattern: `main`
3. ✓ Require a pull request before merging
   - ✓ Require approvals (1)
   - ✓ Dismiss stale pull request approvals when new commits are pushed
4. ✓ Require status checks to pass before merging
   - ✓ Require branches to be up to date before merging
   - Add the **`ci / typecheck + lint + test + smoke + e2e`** check
5. ✓ Require linear history (optional; rebases only)
6. ✗ Allow force pushes / deletions (leave off)

Alternatively, via the `gh` CLI:

```bash
gh api -X PUT \
  repos/:owner/:repo/branches/main/protection \
  -f required_status_checks[strict]=true \
  -F required_status_checks[contexts][]='ci / typecheck + lint + test + smoke + e2e' \
  -F enforce_admins=true \
  -F required_pull_request_reviews[required_approving_review_count]=1
```

(The `:owner/:repo` placeholders are filled in by `gh` from the current
checkout.)

## Vercel (recommended for the MVP)

[`vercel.json`](vercel.json) declares the framework and chains migrations
into the build. Vercel auto-detects everything else.

### One-time setup

```bash
# 1. Install the Vercel CLI (or use the dashboard)
pnpm dlx vercel@latest login
pnpm dlx vercel@latest link

# 2. Provision a Postgres database
#    - Neon (https://neon.tech) and Supabase work out of the box.
#    - Cynkra-managed Postgres also works; just supply the connection URL.

# 3. Set the env vars in Vercel: Project → Settings → Environment Variables
#    Required (Production + Preview):
#      NEXTAUTH_URL=https://<your-vercel-domain>
#      AUTH_SECRET=<openssl rand -base64 32>
#      DATABASE_URL=<your prod connection string>
#      GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
#      GITLAB_CLIENT_ID, GITLAB_CLIENT_SECRET
#      EMAIL_SERVER_HOST=smtp.resend.com   # or your provider
#      EMAIL_SERVER_PORT=587
#      EMAIL_SERVER_USER=resend
#      EMAIL_SERVER_PASSWORD=<your Resend API key>
#      EMAIL_FROM=DevNest <noreply@yourdomain.com>

# 4. Update the OAuth apps' callback URLs to the Vercel domain:
#    GitHub:  https://<vercel-domain>/api/auth/callback/github
#    GitLab:  https://<vercel-domain>/api/auth/callback/gitlab
```

### Deploys

- **Pushes to `main`**: `vercel.json` runs `drizzle-kit migrate` against
  `DATABASE_URL`, then `pnpm build`. The deployed instance auto-promotes
  to Production.
- **Pull requests**: each PR gets a Preview deployment with its own URL.
  Same migration runs against the same DATABASE_URL — be careful that
  preview migrations don't break Production. For experimental migrations,
  use a separate preview-only DB.

## Generic Node host (Docker)

The [`Dockerfile`](Dockerfile) is a multi-stage build that produces an
~250 MB image suitable for Fly.io, Cloud Run, Render, or any container
host that exposes port 3000.

```bash
# Build locally
docker build -t devnest .

# Run with real env vars (--env-file or -e flags)
docker run --rm -p 3000:3000 \
  -e NEXTAUTH_URL=https://devnest.example.com \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e DATABASE_URL=postgres://... \
  -e GITHUB_CLIENT_ID=... \
  -e GITHUB_CLIENT_SECRET=... \
  -e GITLAB_CLIENT_ID=... \
  -e GITLAB_CLIENT_SECRET=... \
  -e EMAIL_SERVER_HOST=smtp.resend.com \
  -e EMAIL_SERVER_PORT=587 \
  -e EMAIL_SERVER_USER=resend \
  -e EMAIL_SERVER_PASSWORD=... \
  -e EMAIL_FROM='DevNest <noreply@yourdomain.com>' \
  devnest
```

Migrations are NOT run from the image at startup. Run them separately
before promoting the new image:

```bash
DATABASE_URL=postgres://... pnpm exec drizzle-kit migrate
```

The image's `HEALTHCHECK` polls `/api/health` every 30s; orchestrators
should rely on the same endpoint for readiness probes.

## Smoke checklist (manual, after every prod deploy)

Run through this against the deployed URL after each Production deploy.
Takes ≤ 3 minutes.

- [ ] `GET /api/health` returns HTTP 200 with
      `{"status":"ok","db":"ok","version":"<your version>"}`
- [ ] `GET /` renders without error in the browser
- [ ] **GitHub OAuth**: click "Sign in with GitHub" on `/signin`,
      authorize the app → land on `/feed` signed in. Check the URL bar
      shows the production domain (not a callback hop).
- [ ] **Magic-link** (if email is configured): visit `/signin`, type
      a real email, submit → arrives within ~30s, link returns to
      `/feed`. Verify the link's host matches `NEXTAUTH_URL`.
- [ ] **Create a post** with a fenced ` ```ts ``` ` block + 1-2 tags
      → posts immediately, syntax highlighting renders, code is copyable
- [ ] **Profile** at `/u/<your-handle>` shows the new post + your
      provider snapshot (avatar, repo count). Follower / following
      counts read 0 / 0
- [ ] **Search** for your handle prefix → you appear in the People
      section
- [ ] **Follow another user** → home feed updates to include their
      posts. Their follower count increments by 1 in the next render
- [ ] **Sign out** from the nav → URL ends at `/`, nav shows "Sign in"
- [ ] **/explore** renders without sign-in (use a private window) and
      shows the post you just created
- [ ] Check the deploy logs (Vercel: Functions tab; Docker: `docker
      logs`) — no `[auth][error]`, no PostgresError, no
      uncaughtException

If any item fails, roll back and inspect the deploy logs for an
`x-request-id` to correlate.

## Open prod questions

Tracked in [the design doc](openspec/changes/bootstrap-devnest-mvp/design.md#open-questions):

- **Managed Postgres choice**: Neon (serverless) vs Supabase (full
  Postgres) vs Cynkra-hosted. All work; Neon's serverless driver is
  fastest from Vercel; Supabase ships extras we don't currently use.
- **Magic-link rate limiting**: there is none yet. Open up to the
  public only after this lands (see [open question in design.md](openspec/changes/bootstrap-devnest-mvp/design.md#open-questions)).
- **OAuth access-token storage**: stored plaintext in `accounts` per
  Auth.js default. Encrypt at rest before going public.
