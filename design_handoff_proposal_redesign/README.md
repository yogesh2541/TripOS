# Handoff: TripCraft — Proposal Experience Redesign

## Overview
A premium, "next-gen" redesign of TripCraft's **proposal creation experience**, spanning the three surfaces that make up the product's core USP:

1. **Operator builder** — the internal screen where an agent crafts the quote (line items, pricing, send/share). Includes a dedicated **Send-proposal composer**.
2. **Customer web proposal** — the editorial, magazine-grade page a client opens from the share link.
3. **Proposal PDF** — the downloadable A4 document, designed to feel **identical** to the web proposal.

The direction is a **bolder, editorial evolution** of the existing Atelier Pro brand (navy / sand-gold / ivory, Playfair Display + Inter + JetBrains Mono). The agency's logo + details (a monogram "seal", wordmark, phone/email/web) now run through every surface — cover, repeating PDF header, pricing, and closing.

## About the Design Files
The files in this bundle are **design references created in HTML/React-via-Babel** — high-fidelity prototypes of the intended look, layout, and behavior. **They are NOT production code to paste in.** The task is to **recreate these designs inside the existing tripOS codebase** (Next.js App Router + Tailwind + shadcn/ui + lucide-react + @react-pdf/renderer), reusing its components, server actions, data fetching, and IA. Restyle and re-lay-out; do not re-architect.

This redesign slots onto files that **already exist** — you are modifying, not greenfielding:

| Surface | File(s) to modify |
|---|---|
| Operator builder | `src/components/quotes/quote-builder.tsx` |
| Send composer (new) | new dialog, e.g. `src/components/quotes/send-proposal-dialog.tsx`; wire into `quote-builder.tsx` + `preview-actions.tsx`. Reuse `share-dialog.tsx`, `ShareOnWhatsappButton`, `share-on-whatsapp-button.tsx` |
| Customer web proposal | `src/components/preview-renderer.tsx` (used by `src/app/trips/[id]/preview/page.tsx` and `src/app/share/[token]/page.tsx`) |
| Proposal PDF | `src/components/proposals/proposal-document.tsx` |
| (Data shapes — reference only, don't change) | `src/types` (`buildProposalPricing`, `ProposalPricing`), `src/server/services/proposal-pdf.ts` (`ProposalPdfSnapshot`), `src/lib/ai` (`ItineraryContent`) |
| (Branding tokens) | `src/lib/proposal-branding.ts`, `tailwind.config.ts` |

## Fidelity
**High-fidelity.** Recreate pixel-for-pixel using the codebase's existing libraries. Exact colors, type, spacing, and copy are specified below; the HTML/CSS is the source of truth for layout.

> Two things in the prototype are placeholders, NOT design intent:
> - The **cover & day photos** use the `<image-slot>` web component (a prototype-only drag-drop placeholder). In the app these become real `<img>` / Next `<Image>` (web) and `@react-pdf` `<Image>` (PDF), fed by `itinerary.coverImageUrl` and `day.imageUrl` (already in the data). When **no image** is present, fall back to the styled empty states the prototype shows — solid navy + gold glow for the cover (looks intentional), and a subtly-striped placeholder for day photos.
> - Sample content (the "Wayfarer & Co." Bali trip) is fixture data; real content flows from the trip/quote/agency records.

---

## The Three Themes
Keep the existing `classic` / `editorial` / `minimal` themes (`PROPOSAL_THEMES`). This redesign is the upgraded **`editorial`** treatment and should also raise the bar for the others:
- **classic** — navy cover, gold accents (today's default), now with the larger Playfair scale, the monogram seal, dotted itinerary index, and the navy "Investment" block below.
- **editorial** — the full magazine direction documented here (ivory body, oversized serif, drop cap, pull-quotes, asymmetric day spreads).
- **minimal** — same structure, flat white cover, hairline rules, no photo hero, restrained gold.
The accent color stays per-agency (`proposalAccentColor`, default sand `#C8A96A`) — every gold value below should read from the resolved accent CSS variable, not be hardcoded.

---

## Design Tokens
All exist in `tripcraft.css` / `tailwind.config.ts` today. New/elevated values are flagged.

### Color
| Token | Hex | Use |
|---|---|---|
| `--navy` / `inkwash` | `#0C1620` | Cover bg, Investment block, closing, primary dark |
| `--navy-2` | `#13212F` | Dark hover |
| `--ivory` | `#FAF7F0` | **NEW** proposal paper (warmer than app `#FFFFFF`) |
| `--ivory-2` | `#F3EEE2` | Terms box, day-photo placeholder base |
| `--paper` | `#FFFFFF` | Cards, day-by-day section bg |
| `--sand` / gold | `#C8A96A` | Accent — seal, eyebrows, day numerals, rules, gold bullets (per-agency, default) |
| `--sand-deep` | `#9F7C36` | Legible gold *text* on light |
| `--sand-soft` | `#F2E8D2` | Gold tint fills (stay-card icon chip) |
| `--ink` | `#16191D` | Primary text |
| `--ink-2` | `#3C434B` | Body copy |
| `--muted` | `#6B7077` | Labels |
| `--faint` | `#9BA0A6` | Tertiary / captions |
| `--on-dark` | `#EFEAE0` | Text on navy |
| `--line` / `--line-2` | `#E6E2D8` / `#EEEBE3` | Borders / hairlines |
| `--ok` / `-soft` | `#5C8C69` / `#E7F0E8` | Meal chips, "included" checks |
| WhatsApp green | `#1FA855` | "Send on WhatsApp" button |

### Typography
- **Display / titles / numerals:** Playfair Display — cover title 92px (web) / 74px (PDF), section H 42px, day title 32px, day numeral 62px gold, Investment total 74px.
- **Italic Playfair** — cover subtitle, pull-quotes, closing signature.
- **UI / body:** Inter (400–700) — body copy 15.5px web / 11.5px PDF, line-height ~1.75.
- **Figures / IDs / dates / prices:** JetBrains Mono, `tabular-nums` — every currency value, version tag, share URL, date stamp, page number.
- **Eyebrows / micro-labels:** Inter 600, UPPERCASE, 10px, letter-spacing .22–.34em, color `--muted` (gold variant `--sand-deep`).
- **Drop cap:** overview lead paragraph — Playfair 600, `--sand-deep`, ~78px, floated.

### Shape, elevation, motion
- Radii: proposal cards/sections square-ish (`4–6px`); app/builder controls `8–10px`, cards `14px`. (Editorial proposal intentionally uses **tighter, flatter** radii than the app.)
- Gold rule: `2px` high, `linear-gradient(90deg, --sand, rgba(200,169,106,.15))`, 64px wide.
- Monogram seal: circle, 1px `--sand`-at-65% outer ring + inner ring inset 3px at `--sand`-30%, centered initial in Playfair gold. (In `@react-pdf`, draw two concentric `<View>` circles — no `::after`.)
- Scrims (cover): `linear-gradient(180deg, rgba(8,16,24,.72) 0%, .30 32%, .46 60%, .93 100%)` + gold radial glow top-right `radial-gradient(circle at 82% 12%, rgba(200,169,106,.26), transparent 55%)`.
- Motion (web only; keep existing framer-motion): section fade + 16–24px rise on scroll-in; day blocks stagger. PDF is static.

---

## Surface 1 — Operator Builder (`quote-builder.tsx`)
**Purpose:** the agent builds/edits a quote and sends it.

**Layout:** two columns inside the workspace — `1.5fr` main / `1fr` rail, divider hairline between. Top bar: breadcrumb (Trips › **Bali · Sharma**) + trip facts (days · travellers · dates · status badge).

**Main column (keep all existing builder logic):**
- Header: `QUOTATION` eyebrow + "Version N" (Playfair 26px) + status badge.
- **Version tabs** — pills with status dot + delta chip (mono, e.g. `−₹12,000`), `+` to add a version. (Existing.)
- **Line-item groups** — one rounded card per category (Accommodation / Flights / Experiences / Transfers / Other), collapsible header with category eyebrow + count + mono subtotal; rows = grip · label · mono cost field · remove. (Existing structure, restyled.)
- Actions row: Add line item · Common items · Pull from itinerary. (Existing.)
- Markup % + Discount (with %/₹ segmented toggle). (Existing.)
- Internal notes (operator-only). (Existing.)

**Rail (new emphasis):**
- **Pricing summary** — navy card: Subtotal / Markup / Discount / **Selling price** (Playfair 30px) / per-person line / **Profit + margin** (clearly marked *operator-only*, mono). Total/Per-person segmented toggle. **Never expose cost/markup/profit to the customer** — this block is operator-only.
- **Live preview thumbnail** — scaled-down render of the proposal cover with "Open preview" → `/trips/[id]/preview`.
- **Send & share module** — copyable share link (mono), then: **Send on WhatsApp** (full-width, WhatsApp green), Download PDF, Email. Reuse `ShareDialog` / `ShareOnWhatsappButton` / the `/api/proposals/[quoteId]/pdf` route.
- **Delivery timeline** — Drafted → Sent → Viewed → Accepted (done = green, current = gold w/ ring). Drive from quote status + share/open events if available; otherwise map from `QuoteStatus`.

## Surface 1b — Send Composer (new dialog)
**Purpose:** one focused surface for sending — the "stronger send/share flow."
**Layout:** modal/sheet, header (`SEND PROPOSAL` eyebrow + "Bali · {recipient}" + close). Two columns:
- **Left (compose):** Channel segmented control (WhatsApp / Email / Link-only) — WhatsApp = navy fill + gold icon when active; Recipient field (name + phone from `trip.contact`); Message textarea (prefilled, editable); **Attach PDF** toggle (shows doc size/price); "Quote valid for" (maps to `meta.validityDays`, default 14).
- **Right (preview):** live **WhatsApp message preview** — chat bubble with the message + a link-preview card (cover thumb, "{destination} — {agency}", "7 days · dates · from {perPerson} pp", share URL).
- **Footer:** "Sent from {agency} · WhatsApp Business" + Schedule (secondary) + **Send proposal** (gold CTA).
Wire send to the existing `shareProposalWhatsappAction` / WhatsApp service; "Link-only" → `ShareDialog` token; "Email" → mailto or existing email path.

## Surface 2 — Customer Web Proposal (`preview-renderer.tsx`)
Order of sections (keep existing render-guards, accent CSS var, and the `data-theme` switch):
1. **Cover** (`<header>`, min-height ~760px) — full-bleed `coverImageUrl` (real `<img>`, not CSS bg, so it prints) + scrim + gold glow. Top row: seal + `WAYFARER & CO.` wordmark (Inter 700, .34em) + `CRAFTED TRAVEL` tagline; right: `TRAVEL PROPOSAL` + `v{version} · {dateRange}` (mono). Headline block (bottom): `A JOURNEY FOR {n}` kicker → giant Playfair `{destination}` → italic subtitle → "Prepared for **{name}**" → 4-up meta (Duration / Travel dates / Travellers / Style) with gold micro-labels + icons. *No-image fallback:* solid navy + glow (already looks intentional).
2. **Overview** — `1.35fr / 1fr`. Left: drop-cap lead (the itinerary summary) + a note paragraph. Right: `THE ITINERARY` index — numbered rows (`01`…), place in Playfair, dotted leader, stay name right-aligned. Built from `itinerary.days`.
3. **Day by day** (on white) — section eyebrow + "Day by day" H. Each day = `118px / 1fr` grid: rail (gold Playfair numeral, mono date, pin + city, meal chips) | body (Playfair title, body copy, **photo** if `day.imageUrl` else striped placeholder, "Experiences & highlights" gold-bullet list, "Where you'll stay" card, optional **pull-quote** for highlight days). Keep meal-chip logic and the `isGenericMealNote` suppression already in the file.
4. **Inclusions** — two columns (included = green checks / excluded = muted ✗), aggregated via existing `collectInclusions`.
5. **Investment** — full navy block + glow. Left: `THE INVESTMENT` + total (Playfair 74px) + per-person (mono) + validity line. Right (bordered): "How it breaks down" — category rows (mono amounts) + Total. Selling amounts only.
6. **Terms** — ivory box, two-column small print (`agency.terms`).
7. **Closing** — navy, centered: seal, italic signature note (`signatureNote` or default), agency name (Playfair), contact row (Phone/Email/Web), "Crafted with TripCraft" footer.

## Surface 3 — Proposal PDF (`proposal-document.tsx`)
Mirror Surface 2, paginated. Use `@react-pdf` `StyleSheet` (no `color-mix`, CSS vars, gradients-as-CSS, `::before/::after`, or reliable `gap` — use explicit values + nested `<View>`s + margins). 6 pages:
- **P1 Cover** — full A4 bleed, same structure as web cover at PDF scale (title 74px, 2×2 meta).
- **P2 At a glance** — running header (seal + agency + `· {dest} · v{n}` + `Page X of Y`) + gold-rule section head + summary + table (Day / Where / Stay / Highlights).
- **P3 Day by day (1–3)** / **P4 (4–7)** — compact `70px / 1fr` day rows (gold numeral, title, pin, body, gold-bullet experiences, stay card, meal chips).
- **P5 Investment + Inclusions** — navy total card + breakdown rows + validity, then two-column included/excluded.
- **P6 Closing** — navy, seal, signature, agency, contacts, "Crafted with TripCraft".
Running header repeats on P2–P5 (`<View fixed>`), running footer ("Crafted with TripCraft · for {agency}" + website + page number) on every content page. Keep the existing `repeatLogo`, section-toggle (`showAtAGlance` / `showInclusions` / `showTerms`), and `wrap`/`break` behaviors.

## Interactions & Behavior
- Builder autosave + version actions + accept/reject/revert: **unchanged** — restyle only.
- Send composer: channel switch updates the preview pane; Attach-PDF toggle; Send → existing WhatsApp/share/email actions; Schedule is optional/secondary.
- Web proposal: scroll-reveal motion (existing framer-motion). All links (Open preview, Download PDF) keep current targets. PDF is static.
- Customer-safe guarantee: **cost, markup, and profit must never render on Surfaces 2 & 3** (only selling/total/per-person). Preserve this from the current code.

## State Management
No new global state. Builder keeps its existing draft/autosave/version state. The Send composer is local dialog state (channel, recipient, message, attachPdf, validityDays) seeded from `trip.contact` + quote + agency settings.

## Assets
- **Icons:** lucide-react (the prototype inlines lucide-style paths in `icons.jsx` — use the real `lucide-react` components: Compass, Calendar, MapPin, Users, Building2, Check, X, Plane, Train, Link2, MessageCircle, Download, Mail, Send, ChevronDown/Right, GripVertical, Info, Sparkles, Wand2, Plus, Eye, Phone, Globe, Clock, Copy, Utensils).
- **Fonts:** Playfair Display, Inter, JetBrains Mono — already configured.
- **Photography:** real images via `coverImageUrl` / `day.imageUrl`; no raster assets shipped.
- **Logo:** agency `logoUrl`; the monogram seal is the fallback.

## Files in this bundle
- `Proposal Redesign.html` — open this; the clickable review canvas wiring all surfaces (pan/zoom, click a label to focus fullscreen).
- `proposal.css` — the editorial design system (all proposal/builder/composer/PDF classes + tokens). **Primary spec.**
- `tripcraft.css` — the base Atelier Pro tokens + app primitives.
- `proposal-web.jsx` — customer web proposal.
- `proposal-pdf.jsx` — the 6 A4 PDF pages.
- `builder-screen.jsx` — operator builder.
- `send-composer.jsx` — send-proposal composer.
- `trip-data.jsx` — the sample Bali fixture (content reference + exact copy).
- `icons.jsx` — icon set (map to lucide-react).
- `design-canvas.jsx`, `image-slot.js` — prototype scaffolding only; **do not port** (image-slot → real `<img>`/`<Image>`).
