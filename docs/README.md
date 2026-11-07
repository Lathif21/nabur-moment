# Nabur Moment — Project Plan

Website + back office for **Nabur Moment**, a wedding content creator. One SvelteKit app with three parts:

1. **CMS + public website** — the owner changes images, text, portfolio, packages, testimonials and FAQ herself.
2. **CRM** — clients, bookings (events) on a pipeline board, wedding calendar, activity log.
3. **Accounting** — DP + pelunasan per booking, invoices and receipts (PDF), expenses (per booking and overhead), dashboard and Laba Rugi.

## Documents

| File                                       | What it covers                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| [01-PRD.md](01-PRD.md)                     | Problem, goals, users, concepts, features per phase, acceptance criteria   |
| [02-DATA-MODEL.md](02-DATA-MODEL.md)       | Enums, tables, rules (Neon Postgres + Drizzle)                             |
| [03-SCREENS.md](03-SCREENS.md)             | Public pages and admin screens, section by section                         |
| [04-ARCHITECTURE.md](04-ARCHITECTURE.md)   | Stack, folders, auth + access control, media storage, PDF, deploy          |
| [05-PHASES.md](05-PHASES.md)               | Task backlog by phase (IDs like `P1-04`), each with "Done when"            |
| [06-DESIGN-SYSTEM.md](06-DESIGN-SYSTEM.md) | Colours, fonts, components, public vs admin look                           |
| [CLAUDE.md](../CLAUDE.md)                  | Working rules for Claude Code (at the repo root)                           |
| [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md)     | Items still waiting for a decision. Nothing there is built until answered. |

## Decisions log

Confirmed with Lathif on 7 Nov 2026 (D1–D19 first round, D20–D36 after the open-questions rounds).

| #   | Topic             | Decision                                                                                                                                                                                                |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Stack             | SvelteKit + TypeScript + Neon Postgres (Drizzle). Fresh repo. Patterns borrowed from the Befisien CRM.                                                                                                  |
| D2  | Hosting           | Vercel                                                                                                                                                                                                  |
| D3  | Users             | Owner + admin accounts. The owner manages users and roles in an **Akses & Peran** menu, with a CRUD matrix per module/page.                                                                             |
| D4  | CMS scope         | Images + text + lists (portfolio albums, packages, testimonials, FAQ). Fixed page layouts, not a page builder.                                                                                          |
| D5  | Public pages      | Home, About, Portfolio / Gallery, Packages / Pricelist, Inquiry form, FAQ                                                                                                                               |
| D6  | Media storage     | Neon storage bucket (S3-compatible)                                                                                                                                                                     |
| D7  | Portfolio media   | Photos + vertical videos (uploaded MP4) + embed links (Instagram / TikTok / YouTube)                                                                                                                    |
| D8  | Prices on site    | Full price shown per package                                                                                                                                                                            |
| D9  | Inquiry form      | Saves to the CRM only (no email / WhatsApp alert)                                                                                                                                                       |
| D10 | Client model      | **Person + event**: the client is the person who books; each booking is an event record                                                                                                                 |
| D11 | Pipeline          | Inquiry → Konsultasi → Penawaran → Booked → Persiapan → Hari H → Editing → Selesai, plus Batal                                                                                                          |
| D12 | Booked rule       | A date is booked only after the DP is recorded as paid                                                                                                                                                  |
| D13 | Same date         | Allowed, with a warning on the calendar and the booking form                                                                                                                                            |
| D14 | Payments          | DP + pelunasan. DP is **always 50%** (not editable). Pelunasan due on **Hari H** (first session date)                                                                                                   |
| D15 | Invoices          | Numbered invoice PDF + kwitansi (receipt) PDF, Nabur Moment branding, **no tax**                                                                                                                        |
| D16 | Expenses          | Per booking (direct costs) and overhead (general business costs)                                                                                                                                        |
| D17 | Extras            | Dashboard + Laba Rugi report, wedding calendar. No reminders, no AI.                                                                                                                                    |
| D18 | Language          | Bahasa Indonesia for both the website and the admin. Code, comments and docs in English.                                                                                                                |
| D20 | Sessions          | One booking can hold several sessions on different days (lamaran, akad, resepsi), each with date, time, venue                                                                                           |
| D21 | Numbering         | Invoice `INV/NM/2026/11/001`, kwitansi `KW/NM/2026/11/001` (sequence per month)                                                                                                                         |
| D22 | Bank / methods    | Invoices show the **BCA** account; she accepts every payment method (transfer, cash, e-wallet, other)                                                                                                   |
| D23 | Script font       | **Pinyon Script** (free Google Font) instead of Sloop Script Pro                                                                                                                                        |
| D24 | Approved lists    | Home / About sections in `03-SCREENS.md` A1–A2 and the event types (wedding, akad, resepsi, lamaran, engagement, prewedding, other)                                                                     |
| D25 | Cancellation      | A paid DP is **kept** (not refunded) when a booking is cancelled                                                                                                                                        |
| D26 | Add-ons           | Add-ons yes (managed in admin, added to bookings and invoices); **no discounts**                                                                                                                        |
| D27 | Lookup lists      | Package categories, expense categories and lead sources start as dummy seed data; she edits them in the admin                                                                                           |
| D28 | Spam              | Honeypot field on the inquiry form                                                                                                                                                                      |
| D29 | Accounts          | Vercel + Neon on Lathif's accounts; credentials in `.env` / Vercel env vars                                                                                                                             |
| D30 | Video size        | No upload limit for now                                                                                                                                                                                 |
| D31 | Delivery          | Booking stores the delivery link and raw / edited delivery dates                                                                                                                                        |
| D32 | Existing data     | Entered by hand, no import tool                                                                                                                                                                         |
| D33 | Instagram feed    | Yes, on Beranda (Instagram API, cached daily)                                                                                                                                                           |
| D34 | Owner             | Exactly one owner                                                                                                                                                                                       |
| D35 | Publishing lists  | Portfolio, packages + add-ons, testimonials and FAQ also wait for **Terbitkan**                                                                                                                         |
| D36 | Maroon            | Not part of the palette (it was only the font sheet's background)                                                                                                                                       |
| D19 | Design references | ourcerita.co (editorial, script over B&W photos, scattered photo collage), contentlywed.com (tracked uppercase + italic serif accents, keyword ticker, FAQ accordion). Brand: logo + palette in `ref/`. |
