# CLAUDE.md — Nabur Moment

Website + CMS + CRM + accounting for Nabur Moment (wedding content creator). Read `docs/01-PRD.md` to `docs/06-DESIGN-SYSTEM.md` and `docs/OPEN-QUESTIONS.md` before any task. Tasks live in `docs/05-PHASES.md` by ID (e.g. `P1-03`).

## Stack

SvelteKit (Svelte 5 runes, TypeScript) · Neon Postgres (`aws-ap-southeast-1`, branches `production` + `dev`) · Drizzle ORM with `pg` on the pooled URL, `attachDatabasePool` on Vercel · Better Auth · Tailwind v4 + bits-ui + svelte-sonner · Lucide · Superforms + Zod · svelte-dnd-action · fractional-indexing · Tiptap + sanitize-html · pdfmake · Neon storage (S3 API) · Vercel (`sin1`) with ISR for public pages and Vercel Cron.

Patterns are borrowed from the Befisien CRM (`D:\Lathif Personal\Befisien\internal befisien`): Kanban component, period filter, MoneyInput, invoice counter, payment → invoice status sync, presigned uploads, PDF builders, DB specs on the Neon `dev` branch. Copy and adapt; do not import from that repo.

## SvelteKit notes (same as Befisien)

- No `$lib` alias: use `#lib/...` with the file extension. Files shared with scripts use relative imports.
- Env vars declared in `src/env.ts`, read from `$app/env/private` / `$app/env/public`.
- Internal links through `resolve()` from `$app/paths`, no leading slash.
- Config in `vite.config.ts`; no `svelte.config.js`.
- Inputs use `defaultValue={…}` for server values.
- Dialog cancel buttons inside a `<form>` need `type="button"`.

## How to work

1. Restate the task ID and its "Done when". If the task has a ⚠ Q<n> that is still open in `OPEN-QUESTIONS.md`, **stop and ask** — never pick an answer yourself.
2. Propose a short plan before coding. Stay inside the task's scope.
3. Finish with `npm run check`, `npm run lint`, `npm run test` and the "Done when" checklist.
4. Never edit an applied migration; create a new one.
5. Tick the task in `docs/05-PHASES.md` when done.

## Code rules

- Svelte 5 runes only. Business logic in `src/lib/server/services/`, services take `db` / `tx` first. Routes validate with Zod and call services.
- **Every admin load and form action calls `requirePerm(locals, module, action)`.** The sidebar and buttons use the same permission set. `access` is owner-only.
- Multi-step writes (payment + invoice status + booked_at + activity, stage moves, publish) run in `db.transaction()`.
- `db/client.ts` and `schema/*` must not import `$env`, `$lib` or `@sveltejs/kit`.
- Money: `bigint` whole Rupiah in the DB, `number` in TS, format only with `rupiah()` / `rupiahShort()`. No tax.
- Dates in `Asia/Jakarta` via `@date-fns/tz`; never the server's local time.
- Phones stored as `628…` via `phoneNormalize()`.
- One owner only. Lists (portfolio, packages + add-ons, testimonials, FAQ) publish through `list_publish` like pages do.
- Public pages read **published** CMS content only; drafts only with `?preview=1` + admin session, never cached.
- Media: browser uploads straight to the bucket with presigned PUT; never stream files through a Vercel function. Delete media only when `media_usage` is empty.
- Rich text is sanitised on save.
- **UI copy (site and admin) is Bahasa Indonesia.** Code, comments, commits in English.
- Use the tokens in `06-DESIGN-SYSTEM.md`; no hard-coded hex in components. Lucide icons, no emoji.
- Accessibility: real buttons / links, labels, `aria-label` on icon buttons, keyboard alternative for drag & drop, alt text on site images.

## Domain cheat-sheet

- Booking stages: `inquiry → consultation → quotation → booked → preparation → event_day → editing → completed | lost`.
- `booked` and later require `booked_at` (DP paid). `lost` requires a reason.
- A booking has one or more `booking_session`s (lamaran, akad, resepsi…). First session date = Hari H.
- Schedule: DP fixed 50% (`DP_PERCENT`, not editable) + Pelunasan due on Hari H; installments sum to `agreed_price`.
- Numbers: invoices `INV/NM/{YYYY}/{MM}/{NNN}`, kwitansi `KW/NM/{YYYY}/{MM}/{NNN}`. Invoices show the BCA account; payments may use any method.
- Add-ons only, no discounts: `agreed_price` = package + add-ons.
- Cancelled (`lost`) booking: a paid DP is kept as income; pelunasan cancelled; unpaid invoices voided.
- Invoices are voided, never deleted. `partial` / `paid` come only from payments.
- Expense with `booking_id` = direct cost; without = overhead. Profit = payments − expenses.
- Calendar: booked = DP paid (solid), tentative = has date, no DP (outlined); calendar items are sessions; 2+ bookings on a date = warning, not a block.
