# 06 — Design System

Source: `ref/` (logo on forest, colour + font sheet) and the two reference sites. The public site is **editorial and romantic**; the admin uses the same palette, **denser and quieter**.

## Brand

- **Logo:** "NABUR" in a high-contrast serif with wide tracking, "MOMENT" below in a light tracked sans, cream on forest. Needed as vector files (SVG): cream and forest versions, plus a square mark for favicon / PDF. (Only a JPEG is in `ref/` now.)
- **Feel:** candid, aesthetic, warm. Lots of space, big photos, few words, small tracked captions.

## Colour tokens

| Token         | Hex       | Use                                                                                             |
| ------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `--forest`    | `#113231` | Primary dark: hero overlays, header on dark, admin sidebar, primary buttons, body text on light |
| `--olive`     | `#697655` | Accent: links, secondary buttons, active states, chart series 2                                 |
| `--cream`     | `#FBF6EA` | Page background (site and admin), text on forest                                                |
| `--sage`      | `#B2B7AB` | Dividers, borders, muted fills, chips                                                           |
| `--surface`   | `#FFFFFF` | Cards, drawers, tables in the admin                                                             |
| `--forest-90` | derived   | Hover on forest (mix 90% forest + 10% black)                                                    |
| `--sage-20`   | derived   | Soft background for kanban columns, selected rows                                               |

Status colours for the admin (functional, not brand). Checked at P0-04: every text colour is ≥ 5.4:1 on white, cream, sage-20 and its own background.

| Token       | Text / background     | Use                                  |
| ----------- | --------------------- | ------------------------------------ |
| `--success` | `#2E6B3F` / `#E3F0E2` | Paid, Lunas, Booked                  |
| `--warning` | `#8A5300` / `#FBEDCF` | DP due, same-date warning, due today |
| `--danger`  | `#A3352C` / `#F8E1DD` | Overdue, Batal, expense amounts      |

Secondary text `--ink-2` = `#4D5E5A` (6.3:1 on cream). Olive on `--sage-20` is 4.3:1, so no olive text on kanban columns.

The maroon in the font sheet is only the image's background and is **not** part of the palette.

### Contrast (WCAG 2.2)

| Pair            | Ratio  | OK for                               |
| --------------- | ------ | ------------------------------------ |
| forest on cream | 12.8:1 | all text                             |
| cream on forest | 12.8:1 | all text                             |
| forest on sage  | 6.7:1  | all text                             |
| olive on cream  | 4.5:1  | body text (just passes), links       |
| olive on white  | 4.9:1  | body text                            |
| forest on olive | 2.8:1  | **not for text**; large display only |
| cream on sage   | 1.9:1  | **never for text**                   |

Rule: sage is never a text colour on light backgrounds; olive text only at ≥ 16 px or for links with underline.

## Typography

| Role               | Font                                                                                              | Use                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Script accent      | **Pinyon Script** (Google Fonts, free, OFL) — stands in for Sloop Script Pro from the brand sheet | 1–3 words over photos ("Cerita kita", couple names on hero). Never for body or UI. |
| Display / headings | **Playfair Display**                                                                              | Headlines, couple names (italic), prices, PDF headings                             |
| Body / UI          | **Open Sans**                                                                                     | Paragraphs, forms, admin UI, tracked uppercase captions                            |

Scale (public site, fluid with `clamp`):

| Token     | Size (mobile → desktop) | Font / style                              |
| --------- | ----------------------- | ----------------------------------------- |
| `display` | 40 → 88 px              | Playfair, tight leading 1.05              |
| `h1`      | 32 → 56 px              | Playfair                                  |
| `h2`      | 26 → 40 px              | Playfair, italic variant for accents      |
| `script`  | 44 → 110 px             | Pinyon Script                             |
| `eyebrow` | 11 → 12 px              | Open Sans 600, uppercase, tracking 0.24em |
| `body`    | 16 → 17 px              | Open Sans 400, line-height 1.7            |
| `caption` | 12 px                   | Open Sans, uppercase, tracking 0.16em     |

Admin: body 14 px, headings Playfair 20–28 px, tables Open Sans 13–14 px, money with `tabular-nums`.

## Layout & motifs (public)

- Full-bleed hero photos, often desaturated, with the script line overlapping the serif headline (ourcerita).
- Scattered photo collage on a forest or olive band, slight parallax; on phones a 2-column staggered grid.
- Uppercase tracked eyebrows + italic serif accent words in headings (contentlywed).
- Keyword ticker band separated by `·`.
- Thin sage hairlines, generous whitespace (section padding 96–160 px desktop, 64 px mobile), max text width 60ch.
- Buttons: rectangular, 0–2 px radius, uppercase tracked label; primary forest on cream, inverse cream on forest; text links with an arrow `→`.
- Motion: fade / rise on scroll (200–400 ms), image hover zoom 1.03; all disabled under `prefers-reduced-motion`.
- Photography: keep originals' colour; optional B&W treatment per image is a CMS toggle only if requested (not planned).

## Admin

- Cream page background, white cards with sage borders, forest sidebar with cream text, olive for active items.
- Radius 8 px on cards / inputs, 4 px on chips. Lucide icons. No emoji.
- Kanban columns on `--sage-20`; cards white; payment chip colours from status tokens.
- Same components as the Befisien CRM (Drawer, Modal, ConfirmDialog, StatTile, PeriodFilter, MoneyInput, KanbanBoard), re-themed with these tokens.

## PDF (invoice, kwitansi)

Forest header band with the cream logo, Playfair headings, Open Sans body, amounts right-aligned, "Terbilang" line, bank box on sage-20, footer with contacts.

## Accessibility

WCAG 2.2 AA: contrast above, visible focus ring (olive 2 px + cream offset), alt text required before an image can be used on a published page, keyboard alternative for every drag, accordion and lightbox fully keyboard operable, videos muted by default with controls.
