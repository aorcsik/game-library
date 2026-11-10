# Changelog

## 4.5.0 - 2026-11-10

### Added

- Group the blog post list by month with an `<h2>` heading (for example "NOV 26") above the first post of each month.

## 4.4.1 - 2026-11-10

### Changed

- Add the chapter number ("Ch. N") to the page title and social title of series posts, and use "Ch. N" for the chapter label in the blog list.

## 4.4.0 - 2026-11-09

### Added

- Treat published posts with the exact same title as a series. Chapters are numbered in publishing order, shown on the post and next to the title in the blog list, with links to the previous and next chapters on the post.
- Edit wishlist entries to list included games, one per line. Bundle contents are matched to individual games and remain intact when the wishlist is synced.
- Create, edit, and delete manual wishlist entries on any supported platform, including Steam. Steam-synced entries have read-only sync-managed fields; manual entries are never changed or archived by sync.
- Add an optional store to wishlist entries, editable on both manual and synced entries using the transaction store suggestions. Steam-synced entries default to Steam Store; stores and their icons appear on the wishlist and game details and are preserved during sync.

### Changed

- Share the store field (with its suggestions) between the transaction and wishlist forms.
- Enable Worker observability logs and invocation logs in `wrangler.jsonc`.

## 4.3.0 - 2026-11-07

### Added

- Add a `WISHLIST` KV namespace and a `/wishlist` page that syncs the Steam wishlist (`STEAM_API_KEY`, `STEAM_ID`). Items keep `firstSeen`/`lastSeen`, are archived (never deleted) when they leave the wishlist, and are keyed per platform so PlayStation or GOG can be added later. Sync only stores ids; titles are then resolved in the background in batches of 10 while the page is open, and unresolvable ones are retried after 7 days.
- List wishlist items that match no game under "Wishlist items without a game" on `/games`, with a Create game button.

### Changed

- Replace `publish:games` with `npm run publish` to mirror every configured local KV namespace to production. It is a dry run by default; `npm run publish -- --yes` overwrites matching keys and deletes production-only keys. The internal `sync:dirty` key is excluded and cleared locally after GAMEDB is published. Publish is not atomic; stop local edits while it runs, and rerun it if a namespace fails.
- Include the Font Awesome brand webfont in copied assets so brand icons render.
- Refuse to publish when any configured local KV namespace has not been initialized, preventing an empty source from deleting its production data.

## 4.2.0 - 2026-11-03

### Added

- Support `![youtube:<id or URL>]` Markdown blocks. Only trusted YouTube hosts are accepted; invalid values remain plain text. Valid embeds render as lazy-loaded `youtube-nocookie` iframes, with a CSP `frame-src` entry and responsive styling.
- Add canonical, Open Graph, and Twitter card metadata to blog pages. Social images use the first post image or a YouTube thumbnail; previews and 404 pages are `noindex`.
- Add ESLint with a flat config and `typescript-eslint`, plus a `lint` script.
- Add test coverage for excerpts, YouTube parsing, and blog metadata.

### Changed

- Generate excerpts from parsed Markdown instead of stripping Markdown with regex, and truncate them at a word boundary.
- Replace whitespace with `∙` in post headings and list entries.
- Restyle blockquotes as pull quotes.
- Make TypeScript 6 the default for ESLint compatibility, and use `typescript-7` for the `typecheck` script.

## 4.1.0 - 2026-10-31

### Changed

- improved blog design with new fonts and updated list layout that resembles a dictionary page

## 4.0.0 - 2026-10-30

### Added

- Public blog "aōrora ludens" at `/` (post pages at `/post/yyyy-mm-dd-slug`), with its own stylesheet (`public/assets/blog.css`) and no links to the game library. Only `/`, `/post/*`, `/media/blog/*` (images), and static assets are reachable without authentication; every other route, including `/posts`, still requires admin auth.
- Manage posts from the library admin at `/posts`: Markdown editor (headings, lists, quotes, code, links, images), draft/published state, publication date, draft preview, and deletion. Raw HTML is escaped and only http(s), mailto, and site-relative links are rendered.
- Store posts in a new `POSTS` KV namespace, included in KV backup/restore (`npm run kv:push|kv:pull -- --binding POSTS`) and in `/export.json`.

- Upload images (PNG, JPEG, GIF, WebP, AVIF; up to 10 MB) from the post editor into the `gl-assets` R2 bucket (`MEDIA` binding) and insert them into the Markdown. Uploads are admin-only and validated by file contents; SVG is rejected. Posts store `/media/blog/<id>.<ext>` paths, which are rewritten to `MEDIA_BASE_URL` (`https://assets.aorcsik.com`) when rendered. `npm run dev` also uses the real bucket (`remote: true`), so dev uploads are live immediately; KV data stays local.

- Posts have a stable ID, with the date and slug both editable; the same slug may repeat on different days. Saving a published post is refused, with an explanation, when another published post already has the same date and slug, since they would share one URL. Changing the date or slug of a published post changes its URL.
- Embed a game summary card anywhere in a post with `![game:<key>]` on its own line. The card is a dark panel styled like the game details header, showing the cover, title, release year and date, genres, and the OpenCritic, Metacritic, and Steam review scores linking to those sites, the developers and publishers (linked to the creator's website when they have one; miscredited creators are left out), and the game description clamped to two lines with a Show more link when it is cut off (a small `blog.js`, built by `npm run build:client`); it exposes no ownership or personal data and never links into the library. The editor has a game search with autocomplete and an Insert button; the draft preview flags unknown game keys.
- Posts keep a list of attached images in their metadata. Uploads attach to the post even when the text does not use them, so spare images stay available; images referenced in the Markdown are attached automatically. The editor shows the gallery with Insert and Remove (detach only) buttons.
- Add a Media page (`/media`) listing the bucket's images with the posts that use each one, the posts it is only attached to, and unreferenced files. Uploads record the original file name.

### Changed

- `/` no longer redirects to `/transactions`; open the library at `/transactions`.

## 3.2.0 - 2026-10-26

### Added

- Automatically refresh game ratings in the background when opening a detail page with source data older than one day, using an expiring game-record lock to avoid duplicate refreshes.
- Queue automatic and manual game metadata refreshes in a persistent, sequential Durable Object so opening several games no longer launches concurrent crawls; manual refreshes report their results after the queued job finishes.
- Show the active and pending game refreshes in a live header popup when the local fetcher is enabled.
- Show automatic refresh progress and completion on game pages, reloading once to display newly fetched ratings and reporting failures without a reload loop.
- Show inferred game credits as checked items under each creator. Uncheck a game to record a miscredit, hiding that creator from the games list and striking through the attribution on game details; add optional per-game attribution notes. Only exceptions are stored in the creators namespace.
- Extract Metacritic game artwork on refresh and let each game choose OpenCritic, Steam, or Metacritic as its cover source, with previews and an automatic choice by default.
- Offer Metacritic's main image separately from its card image when they differ.
- Offer Steam's portrait library artwork as a separate cover choice without refreshing metadata; generate and preview its URL from the app ID rather than storing it.
- Prefer the Steam portrait whenever an app ID exists for automatic covers; otherwise use OpenCritic, then Metacritic. Explicit per-game cover choices still take precedence.
- Show creator verification progress on the creators page, counting each distinct developer or publisher credit name only once across all games.
- Manually add comma-separated developer and publisher credits to game records; they appear alongside fetched credits in game lists, search, creator pages, and the raw-credits popup.
- Manually extend a game's genres with comma-separated names; they appear alongside fetched genres in game details, lists, and genre filters.
- Display verified developers and publishers from Steam and Metacritic in the Games list and cards, and include both in title search. On game details, show Developers, Publishers, and OpenCritic-only Creators separately; a creator may have both verified roles.
- Existing local games need `npm run refresh:game-meta` once to populate role-specific names in list metadata.
- Store canonical creator names, aliases, a.k.a. names, and URLs in the existing KV namespace; link creators from games and browse them at `/creators` with expandable game lists, inferred roles, and edit pages. An a.k.a. mention takes display priority over canonical and alias mentions of the same identity.
- List unmatched developer, publisher, and OpenCritic creator names with their games on the creators page, linking each name to a prefilled creation form.
- Sort the creators table by creator name or game count using its column headers, in either direction.
- New creator names appear as red links to a prefilled creation form. Local creator edits can be synced with `npm run kv:push -- --binding CREATORS` (dry run by default).
- Creators can reference another creator as a parent; parent links appear in the directory and detail page, and cycles are rejected.
- List directly linked subsidiaries on their parent creator's detail page.
- Creator detail pages can delete records with confirmation; records used as a parent must be reassigned first.
- Show raw Steam, Metacritic, and OpenCritic credits beside game creators so combined credits can be checked.
- Add confirmed game deletion from the detail page, blocked for linked purchases or personal entries; publish deleted games alongside the updated title index.

### Changed

- Select release dates in manual, Metacritic, OpenCritic, then Steam order. Run `npm run refresh:game-meta` to update existing local game-list metadata.
- Show attribution notes as read-only text with a pencil button on creator game lists; edit with explicit Save and Cancel controls rather than saving on every input change.
- Restyled physical game platform logos with rounded backgrounds, inset icons, and contrasting labels.
- Show release years and a.k.a. attribution beside games on creator pages.
- Made the creator parent selector a searchable dropdown.
- Split comma- or "and"-joined creator credits only when every named contributor matches a known creator (unless the full name already matches), keeping legal suffixes such as "Inc." and "Ltd." with the preceding name before deduplicating identities.
- Normalize "Thunderful" to "Thunderful Development" for developer credits and "Thunderful Publishing" for publisher credits before matching; fetched source values remain unchanged.

### Fixed

- Resolve ampersand-joined creator credits (such as Rudolf Kremers & Alex May) when both people have creator records, without splitting a matching collective name.
- Avoid the misleading Durable Object export warning from KV-only CLI tools (including the automatic pre-dev backup) by using a KV-only local proxy configuration.
- Match OpenCritic tier filters regardless of capitalization in fetched ratings.
- Let browsers restore scroll position on Games, Transactions, and Developers list reloads instead of focusing the search field at the top.

## 3.1.0 - 2026-10-08

### Added

- Added first-purchase sorting and date grouping to the Games list.
- Included unclaimed purchases on game detail pages, dimmed and labeled without counting them as owned.
- Added an Origin platform icon.

### Changed

- Replaced the Games list/card switcher labels with icons, moved release dates into year popovers, and reordered the platform and state columns.
- Reused store logos beside transaction titles in listings and detail pages; untitled single-item transactions now display their item's title.
- Moved multi-item counts beside transaction titles and removed the separate Items and store columns where redundant.
- Updated the dev container workspace mount and removed the obsolete `SOURCE_DIR` setup note.
- Updated Wrangler, Miniflare, Hono and related dependencies, resolving npm audit warnings.

### Fixed

- Paginated local KV key listing and batched value reads so namespace syncs copy every key without per-key Wrangler startup delays.

## 3.0.0 - 2026-10-06

### Breaking changes

- Removed the legacy `/library` pages and routes; use Games and Transactions to browse purchases.

### Added

- Added a card view for games alongside the list, with shared sorting, filtering, and personal-state controls.
- Added transaction acquisition and spending heatmaps, with historical ECB exchange rates for estimated HUF totals.
- Added grouped, multi-select platform filters for transactions and three-state Select all controls across filter dropdowns.
- Added invoice/order reference IDs, per-item notes, and a local KV migration script for ID-only transaction titles.
- Added direct order links for Fanatical and Humble Store references, store logos, and singular item counts.
- Added platform distinctions for mobile systems and Apple Arcade, with dedicated icons.

### Changed

- Replaced copied state and dropdown SVGs with Font Awesome Pro icon fonts; build font assets on install.
- Added a local-only `LOCAL_DEV` setting to bypass authentication during development.
