# Woodfarm Kebab & Pizza

A Just Eat–style single-restaurant ordering site, rebuilt from real public data
for a real Oxford takeaway, backed by Supabase (Postgres schema `justeat`) with
Supabase Auth.

```
npm install
cp .env.example .env      # then add SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

The site renders and can be browsed **before** the database is seeded — it falls
back to the JSON in `data/`. Creating an account, syncing a basket, checking
out, saving addresses, favourites and reviews all require the database.

## Data provenance

Nothing in `data/` was invented. The menu, prices and restaurant details are the
real ones, and the source of each is recorded in
`data/restaurant.json` → `restaurants[0].provenance`.

| What | Source |
| --- | --- |
| Menu (16 categories, 121 items, 150 variations) | `eateasy.co.uk` restaurant menu page |
| Name, cuisines, address, rating, fees, ETAs, phone | Just Eat discovery API `…/restaurants/enriched/bypostcode/OX3 8RA` |
| Opening hours, FAQs, delivery postcodes | Public listing data |
| Dish images (47 of 121 items) | Just Eat's own generic-product set on its public Cloudinary folder |
| Restaurant logo + photo | Just Eat CDN, and the eateasy listing |

Just Eat's own site returns `403` to automated requests, so the menu was read
from a public mirror of the same listing and the structured restaurant record
from Just Eat's public discovery API. The Just Eat logotype is trademarked, so
`components/Logo.tsx` is an original stand-in. The **colour system is the real
one**, taken from the official `justeat/fozzie-colour-palette` repository
(JET Orange `#ff8000`, web orange `#f36d00`).

**Reviews are deliberately empty.** Just Eat does not expose written review
text through its public API, and fabricating customer reviews for a real
business would be wrong. The restaurant's genuine aggregate rating (3.8 from 76
ratings) is shown, and signed-in customers can post their own via
`POST /api/reviews`.

## Images

`just-eat.co.uk` returns `403` to automated requests, so the menu page is saved
from a browser rather than fetched. The page embeds its whole menu as a Next.js
`__NEXT_DATA__` JSON blob, and every product there carries an `imageSources`
path — so this project uses the images **the Just Eat page itself shows**, not
invented ones.

```sh
npm run parse:je-images   # extract product + category images -> data/je-images.json
npm run upload:images     # download + upload to Supabase Storage (needs service key)
npm run import:data       # writes image_url into menu_items and menu_categories
```

Save `data/raw/menu-je.html` first: open the menu page in Chrome, scroll so all
sections load, `Ctrl+S`, choose **Webpage, Complete**.

### What the page actually contains

Of our **121** menu items, the page supplies an image for **49**, and of those
only **7 are the restaurant's own photographs**:

| Provenance | Items | What it is |
| --- | --- | --- |
| `restaurant-photo` | 7 | Uploaded by the restaurant: Margherita, Chicken Tikka, Peri Peri Chicken, BBQ Chicken, Meat Feast, Meatballs, Chicken Strips Wrap |
| `just-eat-generic` | 38 | Just Eat's generic stock dish set, shown because the restaurant uploaded no photo |
| `just-eat-experiment` | 4 | From Just Eat's internal "Project Flashmob" grocery set — and 2 of those are mis-tagged upstream (Mexican shows a jar of salsa, Canned Drinks shows a beer can) |

The remaining **54** items are listed on the page with no photograph at all, and
**18** cannot be matched by name (branded drinks, and portion variants the
eateasy parser rendered as `4 Pcs`). Categories fare better: **13 of 16** have an
image; Family Meal, Meal Deals and Kids Meals have none.

So the coverage is genuinely limited by the source, and no photograph is ever
substituted for a dish that has none — those cards render a tinted monogram
instead of a plausible-looking fake.

Uploads land in the public `menu-images` bucket as `menu/<category>/<name>-<id>.jpg`
and `categories/<slug>.jpg`, plus `restaurant/logo.gif`. `data/images.json`
records the resulting public URLs; both the importer and the pre-import JSON seed
read it, so images work whether or not the database has been seeded. The bucket
is created by the upload script — `supabase/storage.sql` exists only for a
SQL-only workflow. Writes require the service role; public reads are open.

## Database setup

1. Apply the schema once:

   ```sh
   psql "$DATABASE_URL" -f supabase/schema.sql
   ```

   It creates the `justeat` schema, all tables, the `profiles` signup trigger,
   single-default-address enforcement, row-level security and grants.

2. In **Dashboard → Settings → API**, add `justeat` to the exposed schemas
   (Database → Exposed schemas), otherwise PostgREST will not see the tables.

3. Seed the catalogue (needs `SUPABASE_SERVICE_ROLE_KEY` in `.env`):

   ```sh
   npm run import:data
   ```

   Idempotent — the restaurant is upserted by `source_id` and the menu is
   replaced. Re-importing does not damage order history: `order_items` snapshots
   name and price and its `item_id` is `on delete set null`.

## Admin console

`/admin` is a Just Eat–style back office for the staff side: an overview
dashboard, an orders board with status progression (each step is logged to
`order_status_history`, which the customer's progress tracker reads), a menu
editor (prices, sizes/portions, availability, the "Popular" flag that powers
the storefront's "Have you seen…?" strip), category management, and a content
editor for deals, FAQs and opening hours.

Becoming an admin is a database decision, not a sign-up flag:

```sql
update justeat.profiles set is_admin = true where email = 'you@example.com';
notify pgrst, 'reload schema';
```

The menu and category editors each show an image field that accepts either a
paste-in URL or a file upload. Uploads go to the existing public
`menu-images` Supabase Storage bucket via `/api/admin/upload` (admin-authenticated,
5 MB ceiling, images only) and the returned public URL fills the field.

Visitors who aren't signed in are sent to `/login?next=/admin`; signed-in
non-admins are redirected home. Every `/api/admin/*` handler re-checks the row
via `requireAdmin()` with the service-role client, so a forged cookie is not
enough. On the storefront, `app/(shop)` (header/footer/basket) is a route group
so the admin console renders as a clean shell without the shop chrome.

An end-to-end smoke test covers the whole loop — it creates a throwaway admin,
places a real order, walks it through every status transition, then removes all
its rows:

```sh
# with a dev or prod server running (auto-detected on :3000 / :3100, or point
# it anywhere with ADMIN_SMOKE_URL=…)
npm run smoke:admin
```

### Address autocomplete

Checkout and the saved-addresses form offer Google Places lookup on the first
address line (`components/AddressAutocomplete.tsx`). Set the key:

```sh
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=
```

In Google Cloud Console enable the **Places API** and **Maps JavaScript API** for
the key's project (this requires billing), then restrict the key to your site's
HTTP referrers (`http://localhost:3000/*`, your production domain, etc.).
It is a browser key, so the `NEXT_PUBLIC_` prefix is expected and safe. Without
a working key the field simply behaves as a normal text input.

## How ids work

A menu id is either a database uuid (seeded) or the upstream `sourceId` string
such as `251448461` (JSON seed, pre-import). `lib/menu-ids.ts` translates
source ids to uuids wherever they are about to be written into a uuid column, so
the same client code works in both states.

## Security notes

- Prices are never trusted from the browser. `lib/orders.ts` re-prices every
  basket line from the database on the server, and `/api/orders` recomputes
  totals from those lines.
- The `orders` insert policy only allows `status = 'pending'`, so a client
  cannot forge a delivered or cancelled order.
- Every account-scoped table is locked to `auth.uid()`; the anon key has
  read-only access to the public catalogue and cannot reach another customer's
  basket, orders, addresses or favourites.
- `SUPABASE_SERVICE_ROLE_KEY` is read only by `scripts/import.mjs` and is never
  bundled into the browser.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run parse:menu` | Re-scrape the eateasy menu into `data/menu.json` |
| `npm run parse:je-images` | Extract the images the Just Eat page actually shows |
| `npm run upload:images` | Upload product, category and logo images to Supabase Storage |
| `npm run import:data` | Load `data/*.json` into the `justeat` schema |
| `npm run smoke:admin` | End-to-end admin + order-flow smoke test (cleans up after itself) |

## Layout

```
app/                  routes, API handlers, layouts
  (shop)/             customer-facing pages + header/footer/basket layout
  admin/              staff console (layout guards + overview/orders/menu/…)
  api/admin/          staff APIs (orders, categories, items, variations, content)
  api/                restaurant, menu, basket, orders, addresses,
                      favourites, reviews, delivery-check
components/           UI, incl. BasketProvider (client basket state)
lib/pricing.ts        pure basket maths, shared by client and server
lib/orders.ts         server-side repricing and order references
lib/order-status.ts   order status labels, styles and allowed transitions
lib/menu-ids.ts       source-id → uuid resolution
lib/data.ts           Supabase queries + JSON seed fallback
scripts/              menu parser, image resolver, uploader, database importer
supabase/schema.sql   schema, triggers, RLS, grants
supabase/storage.sql  image bucket + public read policy
data/                 scraped JSON (menu, restaurant, image map, raw responses)
data/images.json      upload manifest (written by upload:images)
```
