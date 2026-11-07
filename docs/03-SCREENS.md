# 03 — Screens

UI copy is **Bahasa Indonesia**. Labels below are the ones to use.

## A. Public website

Look and feel: editorial and romantic, inspired by ourcerita.co and contentlywed.com, in Nabur Moment colours (see `06-DESIGN-SYSTEM.md`). Every image and text block below is **editable in the CMS**; `[CMS]` marks the editable fields. Every section has a show / hide toggle.

### Global

- **Header:** logo (cream on dark hero, forest on light pages), nav: Beranda · Tentang · Portofolio · Paket · FAQ · **Booking** (button). Phone: hamburger → full-screen menu on forest.
- **Footer:** logo, short line `[CMS]`, Instagram / TikTok / WhatsApp / email links `[CMS]`, © year, "Pesan sekarang" link.

### A1. Beranda (`/`) (sections approved, Q21)

| #   | Section        | Content `[CMS]`                                                                               | Layout notes                                                                                        |
| --- | -------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | `hero`         | background image or vertical video (+ poster), script line, serif headline, small caption     | Full-bleed, B&W-capable photo with script overlay (ourcerita). Scroll cue "GULIR".                  |
| 2   | `collage`      | 6–9 images, centre headline, button (label + link)                                            | Scattered floating photos on a forest or olive band, slight parallax; grid on phones                |
| 3   | `intro`        | eyebrow, headline, paragraph, image                                                           | Text + image split                                                                                  |
| 4   | `ticker`       | list of words (e.g. "ROMANTIS · CANDID · ESTETIK")                                            | Marquee band (contentlywed); pauses on `prefers-reduced-motion`                                     |
| 5   | `featured`     | heading, up to N featured albums (picked automatically from albums flagged featured)          | Album cards with cover + couple names in italic serif                                               |
| 6   | `packages`     | heading, paragraph, button → Paket                                                            | Teaser; optionally shows featured packages                                                          |
| 7   | `testimonials` | heading; items come from Testimoni                                                            | Large quote, name in tracked caps; swipe on phones                                                  |
| 8   | `cta`          | background image, headline, button → Booking                                                  | Full-bleed                                                                                          |
| 9   | `follow`       | heading, handle, number of posts (6 / 9); posts come from the Instagram feed; fallback images | Grid of latest Instagram posts linking to each post; falls back to the CMS images if the feed fails |

### A2. Tentang (`/tentang`) (sections approved, Q21)

`hero` (image, title) · `story` (eyebrow, heading, paragraphs, image) · `approach` (heading + 2–3 blocks: title + text) · `team` (list: photo, name, role, short bio) · `cta`.

### A3. Portofolio (`/portofolio`, `/portofolio/[slug]`)

- **List:** intro `[CMS]`, filter chips by event type, grid of albums (cover, "Nadia & Raka", event type · city). Published albums only, ordered by `position`.
- **Album:** hero cover, title, date · venue, story; media in a masonry-like grid where vertical videos play muted on hover / tap (with controls), embeds load on click (privacy + speed), lightbox for photos with swipe and keyboard. "Album lainnya" + CTA.

### A4. Paket (`/paket`)

- Intro `[CMS]`; tabs or sections per package category
- Package cards: image (optional), name, **price in full** (`Rp 7.500.000`), inclusions list, note, "Pilih paket" → Inquiry form with the package preselected. Featured card highlighted.
- Add-ons list (those with "tampilkan di situs"): name, price, description.
- Notes block `[CMS]` (e.g. DP terms, transport outside the city).

### A5. FAQ (`/faq`)

Intro `[CMS]`, accordion of FAQ items (one open at a time, keyboard accessible), CTA.

### A6. Booking / Inquiry (`/booking`) and thank-you (`/booking/terima-kasih`)

- Intro text + image `[CMS]`
- Form fields: Nama* · No. WhatsApp* · Email · Instagram · Jenis acara* · Tanggal acara (utama) · Lokasi / venue · Kota · Paket yang diminati (select from visible packages, "Belum tahu") · Tahu kami dari mana (lead sources) · Pesan
- Validation inline, phone normalised. Hidden honeypot field; a filled honeypot returns the thank-you page but saves nothing.
- On submit: client matched by WhatsApp or created → booking in `Inquiry` with `origin = website_form` → activity "Inquiry dari website".
- Thank-you page text `[CMS]`.

### SEO

Per page: title, description, share image `[CMS]` (falls back to site defaults). `sitemap.xml`, `robots.txt`, album pages in the sitemap.

## B. Admin (`/admin`)

Denser, calmer version of the brand (cream background, forest sidebar). Every menu and button is shown only if the user has the permission; the server checks again.

### Sidebar

Dashboard · Kalender · Booking · Klien · **Keuangan** (Invoice, Pembayaran, Pengeluaran, Laba Rugi) · **Konten** (Halaman, Portofolio, Paket, Testimoni, FAQ, Media) · **Pengaturan** (Situs, Bisnis & Keuangan) · **Akses & Peran** (owner) · Lihat situs ↗ · profile / Keluar.

### B1. Login (`/admin/login`)

Logo, email, password, "Masuk". Hero image from the CMS. No sign-up, no "lupa password" link (the owner resets passwords).

### B2. Dashboard

Period filter (Harian / Mingguan / Bulanan default / Tahunan / Custom, ‹ ›). KPI tiles: Pemasukan, Pengeluaran, Laba bersih, Piutang — each with "vs periode sebelumnya". Chart Pemasukan vs Pengeluaran over time. Panels: Acara 30 hari ke depan (date, H-n, client, payment chip), Invoice jatuh tempo / terlambat, Ringkasan pipeline (count per stage), Inquiry baru.

### B3. Kalender

Month grid (Monday first). Each day lists booking **sessions** ("Akad · Nadia & Raka · 08:00"): solid chip = Booked (DP paid), outlined = tentative, warning dot when a day has 2+ bookings. Click → booking drawer. Phone: agenda list. Filter: event type, include tentative.

### B4. Booking

- **Board:** 9 columns (Inquiry … Selesai, Batal collapsed). Card: client, title, event type chip, next session date + H-n, package, price, payment chip. Drag, or "Pindah ke…". Header: count + total value. Moving to Booked without paid DP → modal "DP belum lunas" with "Catat pembayaran DP".
- **List:** table with search, stage, event type, session month filters.
- **New booking drawer:** client (search or create inline), title, main event type, **sessions** (add / remove rows: jenis sesi, tanggal, jam mulai–selesai, venue, kota; each date shows "Sudah ada booking di tanggal ini" when shared), package (prefills price), add-ons (pick from list or custom line, qty), agreed price (= package + add-ons, editable), notes.
- **Booking page** (`/admin/booking/[id]`): header (title, stage, first session date, H-n) · Sesi (list of sessions) · Paket (snapshot) + Add-ons · **Pembayaran**: schedule (DP / Pelunasan: amount, due, status), invoices, payments with kwitansi download, "Buat invoice", "Catat pembayaran" · **Biaya** (direct expenses, "Tambah biaya") · **Ringkasan**: harga, dibayar, sisa, biaya, laba · Aktivitas (composer + timeline) · **Pengiriman** (link, raw dikirim, edited dikirim) · Catatan.

### B5. Klien

List (search, source filter), drawer form, client page: contact buttons (WA / IG / email), bookings, totals (paid, outstanding), activity.

### B6. Keuangan

- **Invoice:** list (status, period, search); invoice page with items, status chip, "Tandai terkirim", "Unduh PDF", "Batalkan (void)", payments.
- **Pembayaran:** list (period, method), form (booking, invoice/installment, date, amount, method, proof upload), "Unduh kwitansi".
- **Pengeluaran:** list (period, category, Per booking / Overhead filter), form (date, amount, category, booking optional, description, method, receipt photo).
- **Laba Rugi:** year selector, table by month: Pemasukan, Biaya langsung, Overhead, Laba bersih; totals row.

### B7. Konten (CMS)

- **Halaman:** list of pages with status (Draf berubah / Terbit). Page editor = list of its sections; each section is a card with a form generated from the section registry (text inputs, limited rich text, image picker, image list with drag order, link fields, list editor). Buttons: Simpan draf (autosave), Pratinjau (opens the page with `?preview=1` for logged-in users, showing draft content), **Terbitkan**, Kembalikan ke versi terbit.
- **Portofolio:** album list (drag order, featured, show / hide), **Terbitkan** button for the list; album editor (fields + media grid: upload, pick from library, add embed URL, drag order, set cover, captions).
- **Paket:** **Terbitkan** button (packages + add-ons together); categories + package cards (drag order, visible, featured), editor with inclusions list; **Add-ons** tab (name, price, description, tampilkan di situs, aktif, order).
- **Testimoni / FAQ:** sortable lists with drawer editors and visibility toggles; each has its own **Terbitkan** button.
- Every list shows "Belum diterbitkan" when it has changes not yet live.
- **Media:** library grid with filters (gambar / video / embed, unused), upload (multi-file, progress, browser resize), detail drawer (alt text, focal point picker, "Dipakai di …", delete when unused).

### B8. Pengaturan

- **Situs:** Instagram connection (Hubungkan Instagram, status, last fetch, Perbarui sekarang); business name, logos, contacts, socials, footer, SEO defaults (draft + Terbitkan).
- **Bisnis & Keuangan:** profile for PDFs, BCA account (number + holder) for invoices, expense categories and lead sources (both seeded with dummy values she edits; delete only when unused).

### B9. Akses & Peran (owner only)

- **Pengguna:** list (name, email, roles, active), add user (name, email, temporary password, roles), reset password, deactivate. The single owner account cannot be deactivated, deleted or demoted.
- **Peran:** list of roles; role editor = **matrix**: rows = modules (grouped CRM / Keuangan / Konten / Pengaturan), columns = Lihat (R) · Tambah (C) · Ubah (U) · Hapus (D), with "pilih semua" per row and per column. Read-only modules show only Lihat. Ticking C/U/D auto-ticks R.
- Changes take effect on the user's next request.
