# Changelog

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
