# Game Library - AI Agent Navigation Guide

## Project Overview

**Game Library** is a personal game collection management system built with Next.js 15, TypeScript, and React 19. It aggregates game purchases from multiple gaming platforms (Steam, PlayStation, Xbox, Epic Games, GOG, Amazon Luna, Nintendo Switch, Apple App Store), tracks achievement/trophy progress, and displays aggregated review scores from OpenCritic, Steam, and Metacritic.

### Key Features
- Multi-platform game purchase tracking
- Achievement/trophy progress monitoring
- Review score aggregation from multiple sources
- Personal game ratings and notes
- Advanced sorting, filtering, and grouping
- Static site generation for fast performance
- Sanity CMS integration for data backup/sync

## Architecture

### Tech Stack
- **Framework**: Next.js 15.4.7 (static export)
- **UI**: React 19.1.0
- **Language**: TypeScript 5.8.2
- **CMS**: Sanity (for data sync/backup)
- **Styling**: Custom CSS
- **Icons**: FontAwesome Pro 7.0
- **Build**: Node.js CLI tools

### Data Flow
```
Platform APIs/Files → CLI Tools → Local JSON Files → Sanity CMS (backup)
                                           ↓
                                    Next.js Build
                                           ↓
                                    Static Site
```

## Directory Structure

### `/src` - Source Code
- **`/app`** - Next.js 15 app router
  - `page.tsx` - Main page that loads game data and renders GameLibrary
  - `layout.tsx` - Root layout with metadata
  - `/games/[slug]` - Individual game detail pages

- **`/components`** - React components
  - `GameLibrary.tsx` - Main UI component (sorting, filtering, state management)
  - `GameGrid.tsx` - Grid layout for games
  - `GameRow.tsx` - Individual game row with platform cards
  - `GameRowTitle.tsx` - Game title with ratings and indicators
  - `SearchControl.tsx` - Search functionality
  - `SortControl.tsx` - Sorting controls
  - `*Indicator.tsx` - Various rating/score indicators

- **`/lib`** - Core business logic
  - `types.ts` - TypeScript type definitions
  - `schema.ts` - Data schemas for games, purchases, progress
  - `Config.ts` - Environment configuration
  - `GameDatabaseService.ts` - Game database management (CRUD operations)
  - `GameLibrary.ts` - Main data orchestration (combines all services)
  - `PurchaseService.ts` - Handles purchase data from all platforms
  - `ProgressService.ts` - Manages achievement/trophy progress
  - `NotesService.ts` - User notes and ratings
  - `sanity.ts` - Sanity CMS client
  - `tools.ts` - Utility functions (slug generation, date formatting)
  - `fontawesome.ts` - FontAwesome configuration

- **`/cli`** - Command-line tools
  - `update_game.ts` - Main CLI for updating game database
  - `update_progress.ts` - Updates progress data (unused, integrated into update_game)
  - `ReviewFetcherService.ts` - Scrapes OpenCritic, Steam, Metacritic
  - `ProgressFetcherService.ts` - Scrapes TrueSteamAchievements, TrueTrophies, TrueAchievements
  - `CommandLineArgs.ts` - CLI argument parser
  - `CommandLineTools.ts` - CLI utilities (colors, line reader)

- **`/styles`** - CSS files
  - `global.css` - Global styles
  - `project.css` - Project-specific styles

### `/data` - Data Storage
- **`games.json`** - Main game database (title, IDs, review data)
- **`notes.json`** - User notes, ratings, completion status
- **`game-titles.json`** - Game title index
- **`/purchases`** - Platform-specific purchase data
  - `playstation.json`, `switch.json`, `xbox.json`, `appstore.json`
  - `/transactions/` - Monthly purchase transaction logs (YYYYMM.json)
- **`/progress`** - Cached progress data from achievement tracking sites
- **`/games`** - Individual game data files (notes, special cases)

### `/build` - Compiled TypeScript
- Transpiled JavaScript from `/src/cli` and `/src/lib` for CLI execution

### `/public` - Static Assets
- `/images/games/` - Game cover images
- `/screenshots/` - Game screenshots
- `manifest.json` - PWA manifest

## Key Concepts

### Game Database (`games.json`)
Central database of all games with:
- **Basic Info**: title, key (slug), sameGame (aliases)
- **External IDs**: openCriticId, steamAppId, metacriticUrl
- **Review Data**: openCriticData, steamData, metacriticData
- **User Data**: rating, completed, watched, progress, notes, soundtrack
- **Metadata**: releaseDate

### Purchase Data
Purchase information includes:
- **Platform**: Which platform the game is owned on
- **Type**: Digital vs physical
- **Special**: PS Plus, Netflix (App Store), collection membership
- **Date**: Purchase date (from transaction logs)
- **Cover**: Platform-specific cover image

### Progress Tracking
Achievement/trophy completion percentages from:
- **Steam**: TrueSteamAchievements
- **PlayStation**: TrueTrophies  
- **Xbox**: TrueAchievements

### Sanity CMS Integration
Local JSON files are synced to Sanity for:
- Backup and data portability
- Optional future web-based editing
- Data types: `purchase`, `progress`, `notes`, `purchaseDate`

## Service Layer

### GameDatabaseService
Manages the main game database (`games.json`):
- **`getGames()`** - Returns all games
- **`getGameByTitle(title)`** - Finds game by title (fuzzy matching)
- **`updateGame(game, updates)`** - Updates game data
- **`save(path)`** - Saves database to file
- **`findIndexByTitle(title)`** - Finds game index (checks aliases, platform-specific titles)

### PurchaseService
Aggregates purchases from all platforms:
- **Per-platform methods**: `getSteamPurchases()`, `getPlaystationPurchases()`, etc.
- **`getPurchaseDates()`** - Loads transaction history
- **Data sources**: Steam API, Heroic launcher cache, local JSON files
- **Collections**: Handles game bundles (e.g., Master Chief Collection)

### ProgressService
Fetches achievement/trophy progress:
- **`getSteamProgress()`** - From TrueSteamAchievements
- **`getPlaystationProgress()`** - From TrueTrophies
- **`getXboxProgress()`** - From TrueAchievements
- Caches HTML locally, syncs to Sanity

### NotesService
Manages user notes and ratings:
- **`getGameNotes()`** - Loads from `notes.json`
- **Supports**: rating (-10 to 2), completion, watched status, soundtrack info
- **Notes**: Can reference external JSON files for detailed notes

### ReviewFetcherService
Scrapes review data:
- **`fetchOpenCriticData(openCriticId)`** - Tier, score, critics percentage
- **`fetchSteamData(steamAppId)`** - Review score, description, genres, release date
- **`fetchMetacriticData(metacriticUrl)`** - Metascore, Must Play badge, genres, publisher

### GameLibrary (Main Orchestrator)
**`getGameLibraryData(database, fromSanity)`** - Combines all data:
1. Loads purchases from all platforms
2. Adds purchase dates from transaction logs
3. Fetches progress data
4. Loads user notes
5. Returns `[PurchasedGame[], PlatformList]`

## CLI Tools

### Main Update Script
```bash
npm run update -- [options]
```

**Options**:
- `-i <index>` - Start from specific game index
- `-t <title>` - Force fetch specific title
- `-a <days>` - Refetch if data older than X days (default: 14)
- `-p` - Update purchases from platforms
- `-P` - Update progress from tracking sites
- `-n` - Update notes from local file
- `-d` - Update purchase dates from transactions
- `-s` - Skip game data updates (OpenCritic, Steam, Metacritic)
- `-h` - Help

**Typical Usage**:
```bash
# Full update with purchase dates
npm run update -- -d -s

# Update game review data
npm run update -- -a 30

# Force update specific game
npm run update -- -t "Hollow Knight"

# Update everything
npm run update -- -p -P -n -d
```

### Update Process Flow
1. Load game database
2. (Optional) Update purchases, progress, notes
3. Iterate through purchased games
4. For each game:
   - Prompt for IDs if missing (OpenCritic, Steam, Metacritic)
   - Fetch fresh data if stale
   - Update database
5. Save database and sync to Sanity

## Common Tasks

### Adding a New Game
1. Game appears in purchase data automatically
2. Run `npm run update -- -d -s` to sync purchases
3. Run `npm run update` to fetch review data
4. Provide IDs when prompted (OpenCritic, Steam App ID, Metacritic URL)

### Updating Review Data
```bash
npm run update -- -a 7  # Refetch data older than 7 days
```

### Fixing a Game's Data
```bash
npm run update -- -t "Game Title"  # Force re-prompt for IDs
```

### Adding User Notes/Ratings
Edit `/data/notes.json`:
```json
{
  "notes": [
    {
      "title": "Game Title",
      "rating": 2,
      "completed": true,
      "progress": 100,
      "notes": "Optional notes"
    }
  ]
}
```

Then: `npm run update -- -n -s`

### Adding Purchase Transactions
Create `/data/purchases/transactions/YYYYMM.json`:
```json
[
  {
    "title": "Game Title",
    "purchaseDate": "YYYY-MM-DD",
    "store": "Store Name",
    "platform": "steam",
    "price": "19.99€"
  }
]
```

Then: `npm run update -- -d -s`

### Building the Site
```bash
npm run build  # Compiles Next.js to static site in /out
```

## Data Patterns

### Platform Priority
When a game exists on multiple platforms:
1. Purchase date is set to the earliest purchase
2. Progress is set to the highest progress
3. Each platform maintains its own purchase record

### Game Matching
Games are matched by:
1. Exact title match (case-insensitive, normalized)
2. Game key (slug)
3. Platform-specific titles (steamData.title, etc.)
4. sameGame aliases

### Skip Titles
Non-game content is filtered via `skipTitle` array in `GameLibrary.ts`:
- Media apps (Netflix, Spotify, YouTube)
- Soundtracks and artbooks
- Demos and betas

## TypeScript Types Reference

### Core Types
```typescript
type Platform = 'steam' | 'epic' | 'gog' | 'amazon' | 
                'playstation' | 'appstore' | 'switch' | 'xbox'

type Game = {
  title: string;
  key: string;
  sameGame?: string[];
  openCriticId?: string;
  openCriticData?: OpenCriricData;
  steamAppId?: number;
  steamData?: SteamData;
  metacriticUrl?: string;
  metacriticData?: MetacriticData;
  releaseDate?: string;
  completed?: boolean;
  progress?: number;
  rating?: -10 | -1 | 0 | 1 | 2;
  watched?: boolean;
  notes?: string;
  soundtrack?: string;
}

type PurchasedGame = Game & {
  purchases: PlatformPurchase[];
}
```

## Environment Variables

Required in `.env`:
```bash
SOURCE_DIR=.
STEAM_API_KEY=xxx
STEAM_ID=xxx
STEAM_PROFILE_NAME=xxx
STEAM_ACCOUNT_NAME=xxx
HEROIC_CACHE_DIR=/path/to/heroic/cache
PLAYSTATION_ONLINE_ID=xxx
XBOX_GAMERTAG=xxx
SANITY_API_KEY=xxx
```

## Frontend Features

### Sorting Options
- Title (A-Z)
- Release Date
- Purchase Date
- OpenCritic Score
- OpenCritic Recommendation
- Steam Reviews
- Metascore
- Progress
- Personal Rating
- Genre

### Grouping
Games are automatically grouped when sorted by:
- **Release Date**: By year
- **Purchase Date**: By month
- **Title**: By first letter
- **OpenCritic Score**: By tier (Mighty, Strong, Fair, Weak)
- **Steam Reviews**: By description (Overwhelmingly Positive, etc.)
- **Progress**: Completed, In Progress, Not Started
- **Genre**: By primary genre

### Search
Real-time search filters games by title (searches against game key/slug).

## Troubleshooting

### Game Not Appearing
- Check if title is in `skipTitle` array
- Verify game exists in platform purchase data
- Run with `-p` flag to refresh purchases

### Wrong Review Data
- Use `-t "Game Title"` to re-fetch
- Manually correct IDs in `games.json`
- Check if game page structure changed (update scraper)

### Missing Purchase Date
- Add transaction in `/data/purchases/transactions/`
- Run with `-d` flag
- Format must match existing transaction files

### Progress Not Updating
- Verify username in environment variables
- Check TrueSteamAchievements/TrueTrophies profile is public
- Run with `-P` flag to force refresh

## Development Workflow

1. **Data Updates**: Run CLI tools to fetch latest data
2. **Local Development**: `npm run dev` for hot reload
3. **Type Safety**: TypeScript compilation in `tsconfig.json` and `tsconfig.cli.json`
4. **Linting**: `npm run lint` for code quality
5. **Build**: `npm run build` for production static site
6. **Deploy**: Upload `/out` directory to static host

## Key Files to Modify

| Task | Files |
|------|-------|
| Add new platform | `types.ts`, `PurchaseService.ts`, `GameLibrary.ts` |
| Change UI layout | `GameLibrary.tsx`, `GameGrid.tsx`, `GameRow.tsx` |
| Modify sorting | `GameLibrary.tsx` (sortByOptions, compareGames) |
| Add review source | `ReviewFetcherService.ts`, `schema.ts`, `update_game.ts` |
| Change styling | `/src/styles/project.css` |
| Update skip list | `GameLibrary.ts` (skipTitle array) |

## Notes for AI Agents

- **Always check existing data structures** before modifying types
- **CLI tools must be compiled** (`tsc -p tsconfig.cli.json`) before running
- **Web scraping is fragile** - website structure changes break scrapers
- **Game matching is fuzzy** - check sameGame aliases and platform-specific titles
- **Sanity sync is optional** - local JSON files are source of truth
- **Static export** - no server-side features, all data at build time
- **Purchase date logic is complex** - handle PS Plus, Netflix, bundles carefully
- **Progress data is cached** - HTML files in `/data/progress/`

## Future Considerations (See IMPROVEMENTS.md)

- Database migration to proper DB (PostgreSQL/SQLite)
- API layer for data updates
- Web-based game management UI
- Automated data sync jobs
- Testing infrastructure
- Error handling improvements
- Performance optimizations
