# 01 — Product Requirements

## 1. Problem

Nabur Moment's portfolio, client chats and money live in Instagram, WhatsApp and notes. The owner cannot easily:

- **Update her website** without a developer (new portfolio, new prices, new photos).
- **See every client and booking** in one place, and where each one stands.
- **See which dates are already taken.**
- **Know who has paid what**, what is still owed, and whether the business made a profit this month.

## 2. Goals

| #   | Goal                       | How we know it works                                                                                 |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------- |
| G1  | Self-managed website       | Every image, heading, paragraph and list on the public site can be changed in the admin without code |
| G2  | Inquiries never get lost   | Every inquiry form submission appears as a new booking in `Inquiry`                                  |
| G3  | Every booking has a status | Each active booking sits in exactly one pipeline column                                              |
| G4  | Dates are clear            | The calendar shows booked (DP paid) and tentative dates, and warns when a date already has a booking |
| G5  | Money per booking is known | Each booking shows contract value, DP, pelunasan, paid, outstanding, direct costs and profit         |
| G6  | Business overview          | Dashboard and Laba Rugi show income, expenses and profit for any period                              |
| G7  | Controlled access          | The owner decides which user and role can create / read / update / delete each module                |
| G8  | Fast                       | The public site loads quickly on a phone (images resized, lazy-loaded); admin forms take under 30 s  |

## 3. Non-goals (for now)

- A drag-and-drop page builder (layouts are fixed; content is editable)
- Online payment gateway (payments are recorded manually)
- Tax (PPN / PPh) on invoices
- Reminders / notifications (Telegram, email, WhatsApp)
- AI features
- Client portal
- English version of the site
- Mobile app (both site and admin are responsive)

## 4. Users

| User          | Role    | Access                                                                                            |
| ------------- | ------- | ------------------------------------------------------------------------------------------------- |
| Owner         | `owner` | Everything, including **Akses & Peran** (users, roles, permissions). Built-in, cannot be limited. |
| Admin(s)      | custom  | Whatever the owner grants per module: Create / Read / Update / Delete                             |
| Site visitors | —       | Public website and inquiry form. No sign-up.                                                      |

No public sign-up. The owner creates accounts. There is **exactly one owner**; the owner account cannot be deactivated or deleted, and the owner role cannot be given to anyone else from the app.

## 5. Core concepts

```
Client (person who books) ──< Booking ──┬── Sessions (lamaran, akad, resepsi…)
                                        ├── Payment schedule: DP + Pelunasan
                                                ├── Invoices ──< Payments (kwitansi)
                                                ├── Expenses (direct costs)
                                                └── Activity log
Overhead expenses (no booking)

CMS: Site settings · Page sections (Home, About, Packages, FAQ, Inquiry) · Portfolio albums ──< media
     Packages · Testimonials · FAQ items · Media library
```

- **Client:** the person who contacts and books (name, WhatsApp, email, Instagram).
- **Booking:** one job for a client: main event type, package, agreed price, status on the pipeline, and **one or more sessions** (e.g. lamaran, akad, resepsi), each with its own date, time and venue.
- **Package:** a product from the CMS (name, price, inclusions). The same package list is shown on the site and picked in a booking (price is copied into the booking and can be changed there).
- **Payment schedule:** every booking has two installments: **DP**, always **50%** of the agreed price (not editable), and **Pelunasan** (the other 50%), due on **Hari H** = the date of the booking's first session.
- **Invoice:** a numbered bill for one installment. **Kwitansi:** a numbered receipt for one payment.
- **Expense:** money out, either for a booking (direct cost) or overhead.

## 6. Booking pipeline (`booking_stage`)

| Order | Key            | Label (UI) | Meaning                                                                                |
| ----- | -------------- | ---------- | -------------------------------------------------------------------------------------- |
| 1     | `inquiry`      | Inquiry    | New request (from the website form or added manually)                                  |
| 2     | `consultation` | Konsultasi | Talking / meeting with the client                                                      |
| 3     | `quotation`    | Penawaran  | Package and price offered                                                              |
| 4     | `booked`       | Booked     | **DP paid.** Date is locked on the calendar.                                           |
| 5     | `preparation`  | Persiapan  | Rundown, briefing, crew assignment before the day                                      |
| 6     | `event_day`    | Hari H     | The wedding / event is happening (or today)                                            |
| 7     | `editing`      | Editing    | Selecting and editing; delivering content                                              |
| 8     | `completed`    | Selesai    | Delivered, fully paid                                                                  |
| 9     | `lost`         | Batal      | Did not book or cancelled. A reason is required. A paid DP is **kept** (not refunded). |

**Rules**

- A booking can only enter `booked` (or any later stage) when its DP is paid. Recording the DP payment while the booking is in `inquiry`–`quotation` offers to move it to `booked`.
- Moving a booking to `completed` with an outstanding balance shows a warning (allowed after confirming).
- Moving to `lost` asks for a reason. If the DP was paid it stays as income (kept, not refunded); the pelunasan is cancelled, unpaid invoices are voided and the sessions leave the calendar.
- Cards can be dragged; a "Pindah ke…" menu is the keyboard alternative.

## 7. Features by phase

### Phase 0 — Foundation

- Scaffold, Neon + Drizzle, Better Auth (email + password, no sign-up)
- Access control core: roles, permissions per module × CRUD, `owner` built in
- Design tokens, public layout shell, admin layout shell
- Deploy to Vercel

### Phase 1 — CMS + public website

**Media library**

- Upload images and vertical videos straight to the Neon bucket (presigned PUT); images are resized in the browser to web sizes (WebP) before upload
- Alt text, focal point (for cropping on different screens), usage list ("dipakai di …"), delete only when unused
- Embed links: Instagram, TikTok, YouTube (URL + thumbnail)

**Site settings**

- Business name, logo variants, WhatsApp, email, Instagram, TikTok, footer text, SEO defaults (title, description, share image)

**Pages (fixed sections, editable content)** — see `03-SCREENS.md` for each section's fields

- Home, About, Packages, FAQ, Inquiry (intro text + thank-you text)
- Each section: show / hide toggle, its images and text, live preview link
- Draft vs published: changes are saved as draft and go live on **Terbitkan** (per page)
- Lists (portfolio, packages + add-ons, testimonials, FAQ) also wait for **Terbitkan**: each list has its own publish button; until then the site keeps showing the last published version

**Lists**

- Portfolio albums: title (e.g. "Nadia & Raka"), event type, date, venue, cover, ordered media (photo / video / embed), featured flag, show / hide flag
- Packages: category (dummy list seeded, she edits it), name, price (Rp), inclusions (list), short note, featured, show / hide, order
- Add-ons: name, price, short description, show on site toggle, order (e.g. extra hours, extra reel, extra crew). **No discounts.**
- Testimonials: couple name, quote, photo, event, show / hide, order
- FAQ items: question, answer, order, show / hide

**Public website** (Bahasa Indonesia)

- Home, About, Portfolio list + album page, Packages, FAQ, Inquiry form + thank-you page
- Responsive, image `srcset`, lazy loading, SEO meta + Open Graph, sitemap.xml, robots.txt
- Instagram feed on Beranda: latest posts from her Instagram account, cached and refreshed automatically
- Inquiry form → creates a Client (or matches an existing one by WhatsApp) + a Booking in `Inquiry`. Spam protection: a hidden **honeypot** field.

### Phase 2 — CRM

**Clients**

- List with search and filters (source, has active booking)
- Create / edit: name, WhatsApp, email, Instagram, city, source (dummy list seeded, she edits it), notes
- Click-to-WhatsApp, click-to-Instagram, click-to-email
- Client page: details, bookings, payments summary, activity

**Bookings**

- Pipeline board (columns above), card: client, event type, next session date (with "H-12"), package, price, payment chip (Belum DP / DP lunas / Lunas)
- List view with filters (stage, event type, month of event)
- Booking page: event info, package, agreed price, payment schedule, invoices, payments, expenses, profit, activity, notes, **delivery**: Google Drive link, raw delivered on, edited delivered on
- Activity log: automatic (stage changes, payments, invoices) + manual notes (call, WA, meeting, note)

**Calendar**

- Month view (+ list on phones) of booking **sessions** by session date (a booking with akad + resepsi shows on both days)
- Booked (DP paid) = solid; tentative (has a date, no DP yet) = outlined; lost hidden
- A date with more than one booking shows a warning marker; the booking form warns too (allowed, D13)

### Phase 3 — Accounting

- Payment schedule per booking: DP (fixed 50%) + Pelunasan (50%, due on the first session date). The DP has no fixed due date; the booking is not Booked until it is paid.
- Invoices: number `INV/NM/{YYYY}/{MM}/{NNN}` (e.g. `INV/NM/2026/11/001`, sequence restarts each month), one per installment (or for a custom amount), status `draft` → `sent` → `partial` / `paid` / `overdue`, `void`. Never deleted, only voided.
- Invoice PDF with Nabur Moment branding and the **BCA** account for transfer. No tax.
- Payments: date, amount, method (transfer / cash / e-wallet / other), proof image (optional), linked invoice. Each payment gets a **kwitansi** PDF numbered `KW/NM/{YYYY}/{MM}/{NNN}`. Every method is accepted (transfer to BCA or another bank, cash, e-wallet, other); BCA is only the account printed on the invoice.
- Recording the DP payment → booking can move to `booked` (and the calendar locks the date).
- Expenses: date, amount, category (dummy list seeded, she edits it), booking (optional; empty = overhead), note, receipt photo
- Dashboard: period filter (Bulanan default, Harian / Mingguan / Tahunan / Custom), KPI tiles Pemasukan, Pengeluaran, Laba bersih, Piutang (outstanding), each vs previous period; chart Pemasukan vs Pengeluaran; upcoming events (next 30 days); pipeline counts; overdue invoices
- Laba Rugi per year by month: income, direct costs, overhead, net
- Profit per booking: paid income − direct expenses

### Phase 4 — Later (only if asked)

- Export to Excel · reminders · online payment · English site

No import tool: existing clients, bookings and payments are entered by hand (forms accept past dates).

## 8. Acceptance criteria (summary)

- [ ] Only users created by the owner can log in. Sign-up is impossible.
- [ ] The owner can create a role, tick C/R/U/D per module, assign it to a user; that user sees only allowed menus and every server action enforces the same rule.
- [ ] Every image and text on Home, About, Packages, FAQ and Inquiry can be changed in the admin and goes live after Terbitkan.
- [ ] Portfolio albums with photos, vertical videos and embeds can be created, reordered and published.
- [ ] Package prices on the site match the CMS.
- [ ] An inquiry submitted on the site appears in the CRM in `Inquiry` within seconds.
- [ ] A booking cannot reach `Booked` without a paid DP.
- [ ] The calendar shows booked vs tentative dates and warns on shared dates.
- [ ] Invoice and kwitansi PDFs render with correct numbers, amounts and branding.
- [ ] Dashboard totals equal the sum of paid payments and paid expenses for the same period; Laba Rugi matches the dashboard.
- [ ] Site and admin work on a phone.

## 9. Formatting rules

- Currency IDR, no decimals: `Rp 12.500.000`; short `Rp 12,5 jt`.
- Dates `22 Nov 2026`, times 24-hour `14:00`, timezone `Asia/Jakarta` (WIB) everywhere. Weeks start Monday.
- Countdown on cards: `H-12`, `Hari H`, `H+3`.
- Phone stored as `628…` (no `+`, no leading `0`).
