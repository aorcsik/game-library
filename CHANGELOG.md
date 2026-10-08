# Changelog

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
