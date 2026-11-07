# 02 — Data Model

Postgres on **Neon** (region `aws-ap-southeast-1`, Singapore), accessed through **Drizzle ORM**. Every table has a `uuid` primary key (`gen_random_uuid()`) and `created_at` / `updated_at` (`timestamptz`, default `now()`) unless stated.

- **Money:** `bigint` whole Rupiah. Never floats.
- **Dates:** calendar dates are `date`; moments are `timestamptz`. "Today" is computed in `Asia/Jakarta`.
- **Order:** user-sorted lists use a `position text` fractional index (`fractional-indexing`), so a drag updates one row.

## Entity overview

```
user ──< user_role >── role ──< role_permission (module × CRUD)

client ──< booking ──┬──< booking_session · booking_addon >── addon
                     ├──< booking_installment (dp, pelunasan)
                     ├──< invoice ──< payment
                     ├──< expense (booking_id set)
                     └──< activity
expense (booking_id null = overhead) >── expense_category

media ──< (referenced by) page_section.content, album_item, package, testimonial, site_settings
portfolio_album ──< album_item >── media
package >── package_category
testimonial · faq_item · page · page_section · site_settings · app_settings · counter
```

## Enums

```ts
crud_action = 'create' | 'read' | 'update' | 'delete';
event_type = 'wedding' | 'akad' | 'resepsi' | 'lamaran' | 'engagement' | 'prewedding' | 'other'; // approved (Q22)
booking_stage =
	'inquiry' |
	'consultation' |
	'quotation' |
	'booked' |
	'preparation' |
	'event_day' |
	'editing' |
	'completed' |
	'lost';
booking_origin = 'website_form' | 'manual';
installment_kind = 'dp' | 'pelunasan' | 'other';
invoice_status = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'void';
payment_method = 'transfer' | 'cash' | 'ewallet' | 'other';
activity_type =
	'note' |
	'call' |
	'whatsapp' |
	'meeting' |
	'stage_change' |
	'payment' |
	'invoice' |
	'expense' |
	'system';
media_kind = 'image' | 'video' | 'embed';
embed_provider = 'instagram' | 'tiktok' | 'youtube';
```

`source` (lead source) is a lookup table, not an enum, so the owner can edit it. Seeded with a dummy list she replaces: Instagram, TikTok, Referral, Website, WhatsApp, Vendor partner, Lainnya.

## Auth & access control

### Better Auth tables

`user`, `session`, `account`, `verification` (Better Auth Drizzle adapter). Extra columns on `user`:

| Column   | Type    | Notes                                                                                                                                                                  |
| -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| is_owner | boolean | default `false`. Owner bypasses permission checks. Exactly one owner (partial unique index on `is_owner = true`); cannot be deactivated, deleted or demoted in the app |
| active   | boolean | default `true`. Inactive users cannot log in (sessions deleted)                                                                                                        |

### `role`

| Column      | Type         | Notes                 |
| ----------- | ------------ | --------------------- |
| name        | text, unique | e.g. "Admin Keuangan" |
| description | text         |                       |

### `role_permission`

| Column  | Type                      | Notes                                                  |
| ------- | ------------------------- | ------------------------------------------------------ |
| role_id | uuid → role, cascade      |                                                        |
| module  | text                      | One of `MODULES` in `#lib/permissions.ts` (list below) |
| action  | `crud_action`             |                                                        |
| PK      | (role_id, module, action) |                                                        |

### `user_role`

`(user_id, role_id)` PK. A user can hold several roles; permissions are the union.

### Modules (the rows of the access matrix)

| Module key          | Menu                           | Notes                                    |
| ------------------- | ------------------------------ | ---------------------------------------- |
| `dashboard`         | Dashboard                      | read only                                |
| `calendar`          | Kalender                       | read only (data comes from bookings)     |
| `clients`           | Klien                          |                                          |
| `bookings`          | Booking (board, list, detail)  |                                          |
| `invoices`          | Invoice                        | delete = void                            |
| `payments`          | Pembayaran                     |                                          |
| `expenses`          | Pengeluaran                    |                                          |
| `reports`           | Laba Rugi                      | read only                                |
| `cms_pages`         | Konten → Halaman               | update + publish                         |
| `cms_portfolio`     | Konten → Portofolio            |                                          |
| `cms_packages`      | Konten → Paket                 |                                          |
| `cms_testimonials`  | Konten → Testimoni             |                                          |
| `cms_faq`           | Konten → FAQ                   |                                          |
| `media`             | Konten → Media                 |                                          |
| `site_settings`     | Pengaturan → Situs             | read + update                            |
| `business_settings` | Pengaturan → Bisnis & Keuangan | profile, bank, DP %, categories, sources |
| `access`            | Akses & Peran                  | **owner only**, never grantable          |

## CRM

### `lead_source`

| Column   | Type         | Notes |
| -------- | ------------ | ----- |
| name     | text, unique |       |
| position | text         | order |
| archived | boolean      |       |

### `client` (the person who books)

| Column      | Type               | Notes                                |
| ----------- | ------------------ | ------------------------------------ |
| name        | text, not null     |                                      |
| phone       | text               | WhatsApp, normalised `628…`, indexed |
| email       | text               |                                      |
| instagram   | text               | handle without `@`                   |
| city        | text               |                                      |
| source_id   | uuid → lead_source |                                      |
| notes       | text               |                                      |
| archived_at | timestamptz        | soft delete                          |

### `booking` (one event)

| Column              | Type                 | Notes                                                                          |
| ------------------- | -------------------- | ------------------------------------------------------------------------------ |
| client_id           | uuid → client        |                                                                                |
| title               | text, not null       | e.g. "Wedding Nadia & Raka"                                                    |
| event_type          | `event_type`         | main type of the job (e.g. `wedding`)                                          |
| package_id          | uuid → package, null | the package picked                                                             |
| package_snapshot    | jsonb                | name, price, inclusions copied at selection (site edits don't change bookings) |
| agreed_price        | bigint               | IDR = package price + add-ons total (editable; no discount field)              |
| stage               | `booking_stage`      | default `inquiry`                                                              |
| position            | text                 | fractional index in its column                                                 |
| origin              | `booking_origin`     |                                                                                |
| inquiry_message     | text                 | from the website form                                                          |
| lost_reason         | text                 | required when `stage = lost` (check)                                           |
| booked_at           | timestamptz          | set when the DP is paid                                                        |
| stage_changed_at    | timestamptz          |                                                                                |
| delivery_link       | text                 | Google Drive (or other) link to the delivered content                          |
| raw_delivered_on    | date, null           |                                                                                |
| edited_delivered_on | date, null           |                                                                                |
| notes               | text                 |                                                                                |

**Check:** `stage in (booked … completed)` ⇒ `booked_at is not null` (DP paid). Enforced in the service layer and with a DB check.

### `booking_session` (a booking has one or more)

| Column     | Type                    | Notes                                   |
| ---------- | ----------------------- | --------------------------------------- |
| booking_id | uuid → booking, cascade |                                         |
| event_type | `event_type`            | e.g. `lamaran`, `akad`, `resepsi`       |
| date       | date                    | nullable until known                    |
| start_time | text                    | `HH:mm`, optional                       |
| end_time   | text                    | `HH:mm`, optional                       |
| venue      | text                    |                                         |
| city       | text                    |                                         |
| notes      | text                    |                                         |
| sort       | smallint                | shown in date order; `sort` breaks ties |

- **First session** = the earliest dated session; it drives **Hari H** (pelunasan due date), the card countdown and the dashboard "upcoming" list.
- Same-date warning is checked per session against other bookings' sessions (excluding `lost`).

### `booking_addon`

| Column     | Type                    | Notes                                   |
| ---------- | ----------------------- | --------------------------------------- |
| booking_id | uuid → booking, cascade |                                         |
| addon_id   | uuid → addon, null      | null = custom line typed on the booking |
| name       | text                    | snapshot                                |
| unit_price | bigint                  | snapshot                                |
| qty        | smallint, ≥ 1           |                                         |

Adding / removing add-ons updates `agreed_price` and re-runs the schedule (DP recalculated only while unpaid; otherwise the difference goes to the pelunasan).

### `activity`

| Column      | Type                 | Notes                                 |
| ----------- | -------------------- | ------------------------------------- |
| client_id   | uuid → client        |                                       |
| booking_id  | uuid → booking, null |                                       |
| type        | `activity_type`      |                                       |
| body        | text                 |                                       |
| meta        | jsonb                | e.g. `{ from, to }` for stage changes |
| user_id     | text → user, null    | null = system / website form          |
| occurred_at | timestamptz          | app clock (`new Date()`), not `now()` |

## Accounting

### `booking_installment` (payment schedule)

| Column       | Type                    | Notes                                                                                               |
| ------------ | ----------------------- | --------------------------------------------------------------------------------------------------- |
| booking_id   | uuid → booking, cascade |                                                                                                     |
| kind         | `installment_kind`      | `dp`, `pelunasan`                                                                                   |
| cancelled_at | timestamptz, null       | set on the pelunasan when the booking goes to `lost`                                                |
| amount       | bigint                  | DP = `agreed_price × 50%` (fixed, `DP_PERCENT` constant); pelunasan = the rest (absorbs odd rupiah) |
| due_date     | date, null              | DP: none. Pelunasan: first session date (Hari H), recalculated when sessions change                 |
| sort         | smallint                |                                                                                                     |

Rule: the sum of installments = `agreed_price`. Changing the agreed price recalculates the pelunasan (and the DP while it is unpaid).

### `invoice`

| Column              | Type                             | Notes                                                                                        |
| ------------------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| number              | text, unique                     | `INV/NM/{YYYY}/{MM}/{NNN}`, generated in the same transaction from `counter`                 |
| booking_id          | uuid → booking                   |                                                                                              |
| installment_id      | uuid → booking_installment, null |                                                                                              |
| issue_date          | date                             |                                                                                              |
| due_date            | date                             |                                                                                              |
| items               | jsonb                            | `[{ description, qty, unit_price }]`: package + add-on lines; no discount lines              |
| total               | bigint                           | computed from items, no tax                                                                  |
| status              | `invoice_status`                 | `partial` / `paid` set only by payments; `overdue` by a daily check (on load or Vercel Cron) |
| notes               | text                             |                                                                                              |
| sent_at / voided_at | timestamptz                      |                                                                                              |

Never deleted: voided. A voided invoice with payments is refused.

### `payment` (money in)

| Column         | Type                             | Notes                                |
| -------------- | -------------------------------- | ------------------------------------ |
| booking_id     | uuid → booking                   |                                      |
| invoice_id     | uuid → invoice, null             |                                      |
| installment_id | uuid → booking_installment, null |                                      |
| receipt_number | text, unique                     | `KW/NM/{YYYY}/{MM}/{NNN}`            |
| paid_on        | date                             |                                      |
| amount         | bigint, > 0                      |                                      |
| method         | `payment_method`                 |                                      |
| proof_media_id | uuid → media, null               | transfer screenshot (private bucket) |
| note           | text                             |                                      |

Writing a payment runs, in one transaction: insert → recompute invoice status → if the DP installment is now fully paid and `booked_at` is null, set `booked_at` (and offer the stage move in the UI) → log activity.

### `expense_category`

| Column   | Type         | Notes                                                                                                 |
| -------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| name     | text, unique | dummy seed: Fee crew, Transport, Akomodasi, Konsumsi, Alat / Gear, Iklan, Langganan aplikasi, Lainnya |
| position | text         |                                                                                                       |
| archived | boolean      | delete only when unused                                                                               |

### `expense` (money out)

| Column           | Type                    | Notes               |
| ---------------- | ----------------------- | ------------------- |
| spent_on         | date                    |                     |
| amount           | bigint, > 0             |                     |
| category_id      | uuid → expense_category |                     |
| booking_id       | uuid → booking, null    | null = **overhead** |
| description      | text                    |                     |
| method           | `payment_method`        |                     |
| receipt_media_id | uuid → media, null      | private bucket      |

**Profit** = paid payments − expenses (both by date in the period). Booking profit = its payments − its expenses.

### `counter`

`(key text PK, value int)` — atomic upsert for invoice / kwitansi sequences, e.g. key `INV-2026-11`.

## CMS

### `media`

| Column                      | Type             | Notes                                                         |
| --------------------------- | ---------------- | ------------------------------------------------------------- |
| kind                        | `media_kind`     |                                                               |
| bucket                      | text             | `site-media` (public) or `private-files`                      |
| key                         | text             | object key of the original / largest variant                  |
| variants                    | jsonb            | images: `{ 480, 960, 1600, 2400 }` keys (WebP) + width/height |
| poster_key                  | text             | video poster image                                            |
| mime / bytes                | text / int       |                                                               |
| width / height / duration_s | int              |                                                               |
| alt                         | text             | required for images used on the site                          |
| focal_x / focal_y           | real 0–1         | crop focus                                                    |
| embed_provider              | `embed_provider` | embeds only                                                   |
| embed_url                   | text             | embeds only                                                   |
| uploaded_by                 | text → user      |                                                               |
| status                      | text             | `pending` until the upload is confirmed, then `ready`         |

### `page` and `page_section`

Pages are fixed: `home`, `about`, `packages`, `faq`, `inquiry`, `portfolio` (intro only).

| `page_section` column | Type        | Notes                                         |
| --------------------- | ----------- | --------------------------------------------- |
| page                  | text        |                                               |
| key                   | text        | e.g. `hero`, `intro`, `collage`, `philosophy` |
| sort                  | smallint    | fixed order from the section registry         |
| visible               | boolean     |                                               |
| draft                 | jsonb       | content being edited                          |
| published             | jsonb       | content shown on the site                     |
| published_at          | timestamptz |                                               |
| unique                | (page, key) |                                               |

Each section's JSON is validated by a Zod schema from the **section registry** (`#lib/cms/sections.ts`): field types `text`, `richtext` (limited: bold, italic, link, line breaks), `image` (media id), `images` (ordered media ids), `link` (label + href), `list`. Media ids inside JSON are tracked in `media_usage` so "delete only when unused" works.

### `media_usage`

`(media_id, owner_type, owner_id, field)` — rebuilt on every save of a section, album, package, testimonial or settings.

### `portfolio_album`

| Column         | Type         | Notes                                            |
| -------------- | ------------ | ------------------------------------------------ |
| slug           | text, unique | from the title                                   |
| title          | text         | "Nadia & Raka"                                   |
| event_type     | `event_type` |                                                  |
| event_date     | date         | optional                                         |
| venue / city   | text         |                                                  |
| story          | text         | short paragraph                                  |
| cover_media_id | uuid → media |                                                  |
| featured       | boolean      | shown on Home                                    |
| visible        | boolean      | hide without deleting; takes effect on Terbitkan |
| position       | text         |                                                  |

### `album_item`

`(album_id, media_id, position, caption)`.

### `package_category`

`name`, `position`. Dummy seed: Wedding, Lamaran / Engagement, Prewedding, Event.

### `addon`

`name`, `price` (bigint), `description`, `show_on_site` (boolean), `active` (boolean), `position`.

### `package`

| Column         | Type                    | Notes                                                    |
| -------------- | ----------------------- | -------------------------------------------------------- |
| category_id    | uuid → package_category |                                                          |
| name           | text                    |                                                          |
| price          | bigint                  | shown in full (D8)                                       |
| inclusions     | text[]                  | bullet list                                              |
| note           | text                    | small print                                              |
| image_media_id | uuid → media, null      |                                                          |
| featured       | boolean                 | highlighted card                                         |
| visible        | boolean                 | hidden packages stay selectable in bookings (flag in UI) |
| position       | text                    |                                                          |

### `testimonial`

`name` ("Nadia & Raka"), `quote`, `event_label`, `photo_media_id`, `visible`, `position`.

### `faq_item`

`question`, `answer`, `visible`, `position`.

### `list_publish` (snapshot of each CMS list)

| Column       | Type        | Notes                                                                            |
| ------------ | ----------- | -------------------------------------------------------------------------------- |
| list         | text PK     | `portfolio`, `packages` (categories + packages + add-ons), `testimonials`, `faq` |
| data         | jsonb       | the published rows (only visible ones), with media ids                           |
| published_at | timestamptz |                                                                                  |
| published_by | text → user |                                                                                  |

The list tables are the working copy (draft). **Terbitkan** on a list copies its visible rows into `data` in one transaction. The public site reads only `list_publish`; `?preview=1` reads the tables. Bookings always use the live `package` / `addon` tables. A "Belum diterbitkan" badge shows when a list changed after `published_at`.

### `instagram_feed` (single row)

`token` (long-lived, encrypted), `token_expires_at`, `posts` jsonb (id, media type, media URL / thumbnail, permalink, caption, timestamp), `fetched_at`, `last_error`.

### `site_settings` (single row) and `app_settings` (single row)

- `site_settings`: business name, logo media ids (dark / light), WhatsApp, email, Instagram, TikTok, footer text, SEO title / description / share image. Draft + published like sections.
- `app_settings`: business profile for PDFs (name, address, phone, email, IG, logo) and the transfer account printed on invoices: `{ bank: 'BCA', number, holder }` (number + holder filled in by the owner). DP is not a setting: always 50%.

## Indexes (minimum)

- `booking (stage, position)`, `booking_session (date)`, `booking_session (booking_id)`, `booking (client_id)`
- `client (phone)`, `client` trigram on `name` for search
- `payment (paid_on)`, `expense (spent_on)`, `expense (booking_id)`
- `invoice (status, due_date)`
- `album_item (album_id, position)`
