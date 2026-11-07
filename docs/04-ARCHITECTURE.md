# 04 — Architecture

## Stack

| Layer           | Choice                                                                                                        | Notes                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Framework       | **SvelteKit** (Svelte 5 runes) + **TypeScript**                                                               | Same major version as the Befisien CRM at P0-01 (SvelteKit 3; see CLAUDE.md notes) |
| Hosting         | **Vercel** (`@sveltejs/adapter-vercel`, region `sin1` Singapore)                                              | Public pages prerendered / ISR; admin is SSR                                       |
| Database        | **Neon Postgres**, region `aws-ap-southeast-1`, branches `production` + `dev`                                 | Close to Vercel `sin1`                                                             |
| ORM             | **Drizzle ORM** + `drizzle-kit`, driver `pg` on the pooled URL, `attachDatabasePool` from `@vercel/functions` | Real transactions (payments, stage moves)                                          |
| Auth            | **Better Auth** email + password, `disableSignUp: true`                                                       | Sessions in DB, rate limiting                                                      |
| Access control  | Own RBAC tables + `can(user, module, action)` helper                                                          | See below                                                                          |
| File storage    | **Neon storage bucket** (S3 API via `@aws-sdk/client-s3` + presigner)                                         | Browser uploads with presigned PUT                                                 |
| UI              | Tailwind v4 + bits-ui primitives + svelte-sonner, Lucide icons                                                | Public site uses custom components; admin reuses Befisien-style primitives         |
| Forms           | Superforms + Zod                                                                                              |                                                                                    |
| Board / sorting | `svelte-dnd-action` + `fractional-indexing`                                                                   | Booking board, album media, packages, FAQ, testimonials                            |
| Rich text       | Tiptap (StarterKit subset) + `sanitize-html` on save                                                          | Only bold, italic, link, paragraphs, line breaks                                   |
| PDF             | `pdfmake`                                                                                                     | Invoice + kwitansi, fonts embedded                                                 |
| Charts          | Plain SVG component (as Befisien `GroupedBarChart`)                                                           |                                                                                    |
| Dates           | `date-fns` + `@date-fns/tz` (`Asia/Jakarta`)                                                                  |                                                                                    |
| Scheduled job   | **Vercel Cron** (one daily job: mark overdue invoices)                                                        | No Trigger.dev needed. Alternative: compute `overdue` on read.                     |
| Tests           | Vitest (unit + DB specs on Neon `dev`), Playwright smoke                                                      |                                                                                    |

## Folder layout

```
src/
  routes/
    (site)/                     public website (Bahasa Indonesia)
      +layout.svelte            header / footer from site_settings
      +page.svelte              Beranda
      tentang/  portofolio/  portofolio/[slug]/  paket/  faq/  booking/  booking/terima-kasih/
      sitemap.xml/+server.ts   robots.txt/+server.ts
    admin/
      login/
      (app)/                    guarded layout: session + permissions
        +page.svelte            Dashboard
        kalender/ booking/ booking/[id]/ klien/ klien/[id]/
        keuangan/invoice/ keuangan/invoice/[id]/ keuangan/pembayaran/ keuangan/pengeluaran/ keuangan/laba-rugi/
        konten/halaman/[page]/ konten/portofolio/ konten/portofolio/[id]/ konten/paket/ konten/testimoni/ konten/faq/ konten/media/
        pengaturan/situs/ pengaturan/bisnis/
        akses/pengguna/ akses/peran/ akses/peran/[id]/
    api/
      invoice/[id]/pdf/+server.ts   kwitansi/[id]/pdf/+server.ts
      cron/overdue/+server.ts       (Vercel Cron, checks CRON_SECRET)
      media/[...key]/+server.ts     (only if the bucket cannot be public, see Media)
  lib/
    server/
      db/ (client.ts, schema/*)     no $env / $lib imports
      auth.ts  permissions.ts  storage.ts
      services/                     all business logic, take db/tx first
        clients.ts bookings.ts installments.ts invoices.ts payments.ts expenses.ts reports.ts
        cms-pages.ts albums.ts packages.ts testimonials.ts faq.ts media.ts settings.ts access.ts
      pdf/ invoice-pdf.ts receipt-pdf.ts
    cms/sections.ts                 section registry: page → sections → Zod schema + editor field list
    permissions.ts                  MODULES list + labels (shared with the UI)
    components/ site/ admin/
    format.ts period.ts constants.ts
```

## Access control

- `MODULES` and their allowed actions live in `#lib/permissions.ts` (one source for the matrix UI and the checks).
- On each admin request, `hooks.server.ts` loads the session; `(app)/+layout.server.ts` loads the user's permission set once (`Set<"module:action">`, union of roles; owner = all) into `locals.perms`.
- `requirePerm(locals, module, action)` in every load and form action. Missing → 403 page (load) or `fail(403)` (action).
- The sidebar and buttons read the same set, so hidden UI and server checks never disagree.
- `access` module is owner-only and cannot be put in a role.
- Owner rules: exactly one owner (`is_owner`, unique partial index), created by `scripts/create-user.ts --owner`; never deactivated, deleted or demoted in the app. Changing the owner is a script-only operation.
- Unit tests: matrix → permission set, "C/U/D implies R", owner bypass, refusal on every service entry point that writes.

## CMS content flow

1. Section registry (`#lib/cms/sections.ts`) declares, per page, its sections, their Zod schema and default content. A migration / seed creates one `page_section` row per registry entry.
2. The editor writes to `draft` (autosave). **Terbitkan** copies `draft → published` for every section of that page in one transaction and calls the revalidation (below).
3. Public routes read only `published`. With `?preview=1` and a valid admin session, they read `draft` and are not cached.
4. Lists (portfolio, packages + add-ons, testimonials, FAQ) also wait for **Terbitkan**: the tables are the working copy; publishing copies visible rows into `list_publish` (see `02-DATA-MODEL.md`) and revalidates the affected pages. Public routes read only `list_publish`.

### Caching public pages

- Public routes use Vercel ISR (`config.isr` with a `bypassToken`) so pages are served from cache.
- After Terbitkan or a list change, the server revalidates the affected paths (request with the bypass token / `x-prerender-revalidate`), so changes show within seconds.
- Fallback if ISR revalidation proves awkward: `Cache-Control: s-maxage=60, stale-while-revalidate` — changes visible within a minute.

## Media

- **Upload:** the admin asks `media.createUpload` for presigned PUT URLs; the browser uploads directly to the bucket (no Vercel body-size limit), then calls `media.confirmUpload`, which checks the object exists and marks it `ready`.
- **Images:** resized in the browser before upload to WebP widths 480 / 960 / 1600 / 2400 (only widths smaller than the original), using `createImageBitmap` + `OffscreenCanvas`. The site uses `srcset` + `sizes`, `loading="lazy"` (except the hero), width / height to avoid layout shift, and focal point via `object-position`.
- **Videos:** MP4 (H.264) uploaded as-is, **no app size limit** (decision). Technical ceiling: one presigned PUT carries up to 5 GB on the S3 API, so files above that would need multipart upload (not planned). Large files need a progress bar and a retry; a poster frame is captured in the browser (`<video>` + canvas) and uploaded as an image. Played with `playsinline muted loop` previews and `preload="none"` until visible.
- **Embeds:** store provider + URL; render a click-to-load placeholder (thumbnail + play icon), then the provider's embed iframe.
- **Buckets:** `site-media` must be readable by the public site. **Verify at P1-01** whether a Neon bucket can be public-read with CORS for the domain. If not: keep it private and serve through `api/media/[...key]` which redirects to a presigned GET with long `Cache-Control`, or proxy + cache. `private-files` (payment proofs, receipts) is always private; downloads go through a permission-checked route.
- **Deletion:** only when `media_usage` is empty; objects are deleted after the row.
- CORS for browser uploads is set per branch (like Befisien `storage:cors`).

## Instagram feed

- Uses the Instagram API with Instagram Login (her account must be a **Business or Creator** account). The owner connects it once in Pengaturan → Situs (OAuth); the long-lived token is stored encrypted in `instagram_feed`.
- A daily Vercel Cron job refreshes the token (valid 60 days) and fetches the latest posts into `posts`; the home page reads the cached posts only and revalidates after a fetch. Images are shown from Instagram's CDN URLs as returned; on error the `follow` section uses its CMS fallback images and `last_error` is shown in settings.
- Env: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `TOKEN_ENCRYPTION_KEY`.

## Accounting rules (services)

- `bookings.moveStage`: refuses `booked`+ without `booked_at`; `lost` requires reason and, in one transaction, keeps paid DP payments (income stays), cancels the pelunasan installment, voids unpaid invoices; logs `stage_change`.
- `installments.ensureSchedule(booking)`: DP = 50% of `agreed_price` (fixed), pelunasan = rest, due on the first session date; re-run when price or sessions change.
- `invoices.create`: number from `counter` inside the same transaction (`INV/NM/{YYYY}/{MM}/{NNN}`, receipts `KW/NM/…`, counter key per month, 3-digit padding); `void` refused when payments exist.
- `payments.record`: insert → `syncInvoiceStatus` → if DP fully paid set `booked_at` → activity; all in one transaction. Delete reverses status (and clears `booked_at` only if the booking is still before `booked`; otherwise refused with a message).
- `reports.*`: all money from `payment.paid_on` and `expense.spent_on`, same period helper (`resolvePeriod`) as Befisien, so Dashboard and Laba Rugi match.

## Environments

| Env        | App                    | DB branch    | Bucket             |
| ---------- | ---------------------- | ------------ | ------------------ |
| Local      | `npm run dev`          | `dev` (seed) | dev branch buckets |
| Preview    | Vercel preview deploys | `dev`        | dev                |
| Production | Vercel production      | `production` | production         |

Accounts: Vercel and Neon run on **Lathif's accounts**; credentials go in `.env` locally (git-ignored) and in Vercel project env vars. Note: Vercel Hobby is for non-commercial use, so production for a business belongs on Pro.

Env vars (declared in `src/env.ts`): `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEON_STORAGE_*` (endpoint, key, secret, buckets), `CRON_SECRET`, `ISR_BYPASS_TOKEN`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `TOKEN_ENCRYPTION_KEY`, `PUBLIC_SITE_URL` (planned `https://naburmoment.com`, tentative).

## Security

- Admin under `/admin`, `noindex`, all routes guarded; public site has no authenticated features.
- Inquiry form: Zod validation, length limits, hidden **honeypot** field (filled → fake success, nothing saved).
- Rich text sanitised on save and rendered only from sanitised HTML.
- Presigned URLs short-lived (15 min upload, 1 h private download); content-type and size checked at confirm.
- Passwords via Better Auth hashing; reset by the owner deletes the user's sessions.
