# Changelog

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
