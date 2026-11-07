# 05 — Phases & Task Backlog

Phases run in order. Each task is sized for one Claude Code session.
Prompt template: **"Implement P1-03 from docs/05-PHASES.md. Follow CLAUDE.md. Show me the plan before writing code."**

Legend: `[ ]` to do · `[x]` done · **Depends:** tasks that must be finished first · ⚠ Q<n> = blocked until `OPEN-QUESTIONS.md` item is answered.

---

## Phase 0 — Foundation

Goal: an empty but deployed, branded app; the owner can log in and manage access.

### [x] P0-01 Scaffold

- `npx sv create nabur-moment` (minimal, TypeScript), Tailwind v4, ESLint, Prettier, Vitest, Playwright, `adapter-vercel`
- `#lib` imports, `src/env.ts`, `format.ts` (`rupiah`, `rupiahShort`, `dateID`, `countdown` → `H-12`, `phoneNormalize`) with tests
- Move `docs/CLAUDE.md` to the repo root
- **Done when:** `npm run dev` shows a page; `check`, `lint`, `test` pass; private GitHub repo pushed.
- **Status (7 Nov 2026):** done except the push: local git repo with commits; Lathif creates the GitHub remote.

### [x] P0-02 Neon + Drizzle

**Depends:** P0-01

- Neon project in `aws-ap-southeast-1`, branches `production` + `dev`; `neon.ts` link
- `db/client.ts` (pg pool, error listener, `attachDatabasePool`), `drizzle.config.ts`, scripts `db:generate`, `db:migrate`, `db:studio`
- **Done when:** first migration runs on `dev`.
- **Status (7 Nov 2026):** done. Neon project `nabur-moment` (`sparkling-mode-62231100`, Befisien org), branches `production` + `dev`; `0000_extensions` and `0001_auth` applied on `dev`. Local `.env` points at `dev`.

### [x] P0-03 Auth

**Depends:** P0-02

- Better Auth (email + password, `disableSignUp`), `user.is_owner`, `user.active`
- `hooks.server.ts` → `locals.user`; `/admin/(app)` guard; `/admin/login`
- `scripts/create-user.ts` (`--owner` flag)
- **Done when:** the owner can log in / out; `/admin` redirects to login when logged out; sign-up impossible; inactive users are refused.
- **Status (7 Nov 2026):** done. `users.db.spec.ts` (sign-in, inactive refused, sign-up refused, one owner) and e2e (redirect, wrong password, sign-up endpoint closed, login → logout). Dev owner `owner@naburmoment.test` (password in `.env` as `E2E_PASSWORD`). Login hero is a forest panel until the CMS has images.

### [x] P0-04 Design tokens + shells

**Depends:** P0-01

- Tokens from `06-DESIGN-SYSTEM.md` in `app.css` (`@theme`), fonts (Playfair Display, Open Sans, Pinyon Script for script accents)
- Public layout (header, mobile menu, footer with placeholder content)
- Admin layout (sidebar, topbar, `Drawer`, `Modal`, `ConfirmDialog`, `Field`, `MoneyInput`, `StatTile`, `EmptyState`, toast)
- **Done when:** both shells look like the design at desktop and phone width; sidebar links route to placeholders.

### [ ] P0-05 Access control core

**Depends:** P0-03

- Tables `role`, `role_permission`, `user_role`; `MODULES` in `#lib/permissions.ts`
- `locals.perms`, `requirePerm`, `can()`; sidebar filtered by permission
- **Done when:** unit tests cover owner bypass, union of roles, C/U/D ⇒ R, `access` owner-only, exactly one owner (cannot be deactivated / demoted); a user without a permission gets 403 on load and action.

### [ ] P0-06 Akses & Peran UI

**Depends:** P0-05, P0-04

- Pengguna: list, add (temporary password), reset password (kills sessions), deactivate, assign roles
- Peran: list, create / rename / delete (refuse delete when assigned), CRUD matrix editor
- **Done when:** the owner creates "Admin Keuangan" with Keuangan C/R/U only, assigns it, and that user sees only those menus and cannot delete.

### [ ] P0-07 Deploy

**Depends:** P0-03, P0-04 · ⚠ Q13 (tentative: naburmoment.com)

- Vercel project (`sin1`) and Neon on Lathif's accounts, credentials in `.env` + Vercel env vars, production branch migrated, owner created
- Domain + HTTPS: **naburmoment.com** (tentative; confirm and buy before this task), `www` redirects to the apex
- **Done when:** production URL serves the login and the empty site.

---

## Phase 1 — CMS + public website

Goal: the owner runs the website herself.

### [ ] P1-01 Storage + media library backend

**Depends:** P0-05

- Buckets `site-media`, `private-files` in `neon.ts`; verify public read (see `04-ARCHITECTURE.md` → Media) and pick the serving path
- `media`, `media_usage` tables; `services/media.ts` (`createUpload`, `confirmUpload`, `listMedia`, `updateMedia`, `deleteMedia` when unused); `storage:cors` script
- **Done when:** a DB spec uploads + confirms + deletes an object on the `dev` bucket; delete is refused when used.

### [ ] P1-02 Media library UI

**Depends:** P1-01

- Multi-file uploader with progress; browser image resize to WebP variants; video poster capture; embed URL form (Instagram / TikTok / YouTube)
- Library grid, filters, detail drawer (alt, focal point picker, usage list, delete)
- Reusable `MediaPicker` (single / multiple, upload inside the picker)
- **Done when:** images, an MP4 and an embed can be added, edited and deleted; the picker returns ids.

### [ ] P1-03 Section registry + page editor

**Depends:** P1-02

- `#lib/cms/sections.ts` with schemas + defaults for Home, About, Packages intro, FAQ intro, Portfolio intro, Booking intro / thank-you
- `page_section` table + seed; editor generated from the registry (text, rich text, image, images, link, list); autosave draft; Terbitkan; revert to published; `?preview=1`
- `media_usage` rebuilt on save
- **Done when:** editing any field and pressing Terbitkan changes what the public route reads; preview shows drafts only to logged-in users.

### [ ] P1-04 Site settings

**Depends:** P1-03

- Pengaturan → Situs (logos, contacts, socials, footer, SEO defaults), draft + Terbitkan
- **Done when:** header / footer / meta tags on the public layout come from published settings.

### [ ] P1-05 Packages, testimonials, FAQ (CMS)

**Depends:** P1-02

- `list_publish` + per-list **Terbitkan** (and "Belum diterbitkan" badge)
- `package_category` (dummy seed: Wedding, Lamaran / Engagement, Prewedding, Event), `package`, `addon`, `testimonial`, `faq_item` tables + services + admin screens (sortable, visible toggle, featured)
- **Done when:** items can be created, reordered, hidden; nothing changes on the site until Terbitkan; after it, hidden items are gone and order matches.

### [ ] P1-06 Public pages: Beranda, Tentang, Paket, FAQ

**Depends:** P1-03, P1-04, P1-05, P1-10

- Components for each section in `03-SCREENS.md` A1–A5; responsive images; reduced-motion support; ISR + revalidate on publish / list change
- **Done when:** all four pages render only CMS content, pass Lighthouse mobile ≥ 90 performance / ≥ 95 accessibility on seed content, and update within seconds after Terbitkan.

### [ ] P1-07 Portfolio albums

**Depends:** P1-02

- `portfolio_album`, `album_item`; admin list + editor (media grid, drag order, cover, captions, featured, show / hide, Terbitkan via `list_publish`)
- Public `/portofolio` (filter by event type) + `/portofolio/[slug]` (grid, video previews, click-to-load embeds, lightbox)
- **Done when:** an album with photos, a vertical video and an embed is published and viewable on a phone; an album hidden or added after the last Terbitkan does not appear (404) until the next Terbitkan.

### [ ] P1-08 Inquiry form → CRM

**Depends:** P1-05, P2-01 (tables only)

- `/booking` form + thank-you; package preselect via `?paket=`; Zod validation; hidden honeypot field
- `services/inquiries.ts`: match client by phone or create, create booking `inquiry` / `website_form`, activity — one transaction
- **Done when:** a submission creates exactly one booking (and no duplicate client for the same WhatsApp); a filled honeypot shows the thank-you page and saves nothing.

### [ ] P1-10 Instagram feed

**Depends:** P1-04

- Meta app (Instagram API with Instagram Login), connect button in Pengaturan → Situs, encrypted long-lived token, `instagram_feed` table
- Vercel Cron daily: refresh token, fetch latest posts, revalidate Beranda; fallback to CMS images on error
- **Done when:** the home `follow` section shows her latest posts; disconnecting or a failed fetch shows the fallback images and the error in settings.

### [ ] P1-09 SEO

**Depends:** P1-06, P1-07

- Per-page meta + Open Graph, canonical, `sitemap.xml` (pages + albums), `robots.txt`, `noindex` on `/admin`
- **Done when:** sitemap lists every published album; share preview shows the CMS image.

---

## Phase 2 — CRM

Goal: every client and booking is tracked in the app.

### [ ] P2-01 CRM schema

**Depends:** P0-02

- `lead_source` (dummy seed: Instagram, TikTok, Referral, Website, WhatsApp, Vendor partner, Lainnya), `client`, `booking`, `booking_session`, `booking_addon`, `activity` (+ checks, indexes); seed with demo clients / bookings on `dev` only
- **Done when:** migration on `dev`, seed runs, Drizzle Studio shows data.

### [ ] P2-02 Clients

**Depends:** P2-01, P0-06

- List (search, source filter), drawer create / edit, archive; client page with WA / IG / email buttons, bookings, activity
- **Done when:** clients can be added, edited, archived, searched; WhatsApp link opens `wa.me/628…`.

### [ ] P2-03 Booking board + list + form

**Depends:** P2-02

- Generic Kanban (as Befisien: optimistic move, rollback, `Pindah ke…`), booking board with 9 columns, list view, new / edit drawer with session rows and a same-date warning per session, package prefill + snapshot
- `moveStage` rules (Booked needs DP, Batal needs reason, Selesai with balance warns)
- **Done when:** cards keep order after refresh; moving to Booked without DP is refused with the "Catat pembayaran DP" prompt.

### [ ] P2-04 Booking page + activity

**Depends:** P2-03

- Booking detail layout per `03-SCREENS.md` B4 (payment / cost sections are placeholders until Phase 3), activity composer + timeline
- **Done when:** notes and stage changes appear newest first with author and time (WIB).

### [ ] P2-05 Calendar

**Depends:** P2-03

- Month grid + phone agenda showing sessions, booked vs tentative styles, multi-booking warning, filters, booking drawer
- **Done when:** a day with two bookings shows the warning; tentative bookings can be hidden.

---

## Phase 3 — Accounting

Goal: every rupiah in and out is recorded, and profit is visible.

### [ ] P3-01 Payment schedule

**Depends:** P2-03

- `DP_PERCENT = 50` constant, `booking_installment`, `ensureSchedule`, recalculation on price, add-on or session change; cancellation (`lost`) keeps a paid DP, cancels the pelunasan and voids unpaid invoices; shown on the booking page
- **Done when:** a new Rp 10.000.000 booking gets DP Rp 5.000.000 + Pelunasan Rp 5.000.000 due on its first session date; moving that session moves the due date.

### [ ] P3-02 Invoices

**Depends:** P3-01

- `invoice`, `counter`; create from an installment or custom; items list package + add-on lines (no discounts); draft / sent / void; list + page
- Overdue: Vercel Cron daily 00:15 WIB (or on read)
- **Done when:** numbers are sequential per month under concurrent creation (DB spec); void refused with payments.

### [ ] P3-03 Invoice + kwitansi PDF

**Depends:** P3-02, P3-04

- Pengaturan → Bisnis & Keuangan (profile, BCA account); `invoice-pdf.ts`, `receipt-pdf.ts` (pure document builders + tests), `terbilang` for amounts
- **Done when:** both PDFs render with logo, numbers, amounts in words and bank details.

### [ ] P3-04 Payments

**Depends:** P3-02

- `payment` table, `payments.record` / `delete`, proof upload (private bucket), invoice status sync, DP paid → `booked_at` + offer stage move, kwitansi number
- **Done when:** paying the DP makes the booking bookable and the calendar shows it solid; partial / paid statuses are correct.

### [ ] P3-05 Expenses

**Depends:** P2-01

- `expense_category`, `expense`; list with Per booking / Overhead filter; form with receipt upload; booking page "Biaya" + profit
- **Done when:** booking profit = its payments − its expenses; overhead rows have no booking.

### [ ] P3-06 Dashboard

**Depends:** P3-04, P3-05

- `resolvePeriod` + `PeriodFilter`, KPI tiles with deltas, income vs expense chart, upcoming events, overdue invoices, pipeline counts, new inquiries
- **Done when:** totals match the sum of payments / expenses for the period (checked against seed).

### [ ] P3-07 Laba Rugi

**Depends:** P3-06

- `/admin/keuangan/laba-rugi`, year selector, months × (Pemasukan, Biaya langsung, Overhead, Laba bersih)
- **Done when:** the year total equals the Dashboard for Tahunan of the same year.

---

## Phase 4 — Hardening & launch

### [ ] P4-01 Seed real content

- Owner uploads real photos, packages, FAQ; replaces the dummy lists; replace all placeholder copy
- Owner enters existing clients, bookings, sessions, payments and expenses by hand (forms accept past dates; kwitansi / invoice numbers use the month of the payment / issue date)
- **Done when:** no seed / lorem content is visible on production and her existing bookings are in the app.

### [ ] P4-02 QA

- Playwright smoke: inquiry → board → DP payment → calendar → invoice PDF → dashboard; permission smoke with a limited role
- Accessibility pass (keyboard, contrast, alt text present on every published image)
- **Done when:** smoke tests pass on a preview deploy.

### [ ] P4-03 Owner handover

- Short guide (Bahasa Indonesia) for the CMS, bookings and payments; backups (Neon PITR window noted)
- **Done when:** the owner updates the home hero and records a payment without help.

### Later (only if requested)

Excel export · reminders · online payment · English site
