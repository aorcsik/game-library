import { colorize, LineReader } from './CommandLineTools';
import GameDatabaseService from '../lib/GameDatabaseService';
import { fetchMetacriticData, fetchOpenCriticData, fetchSteamData } from './ReviewFetcherService';
import { calculateTimeDifference } from '../lib/tools';
import CommandLineArgs from './CommandLineArgs';
import { getGameLibraryData } from '../lib/GameLibrary';

process.env.TZ = 'UTC';

const lineReader = new LineReader();

const args = new CommandLineArgs({
  'startIndex': {
    shortHand: 'i',
    description: 'Start index for fetching games',
    default: 0,
    parameter: 'index',
    type: 'number',
  },
  'fetchTitle': {
    shortHand: 't',
    description: 'Force fetching a specific title',
    default: '',
    parameter: 'title',
    type: 'string',
  },
  'refetchAge': {
    shortHand: 'a',
    description: 'Refetch if data is older than this many days',
    default: 14,
    parameter: 'days',
    type: 'number',
  },
  'updatePurchases': {
    shortHand: 'p',
    description: 'Update purchases from Steam, Epic, GOG, etc.',
    default: false,
    parameter: null,
    type: null,
  },
  'updateProgress': {
    shortHand: 'P',
    description: 'Update progress from TrueSteamAchievements, TrueTrophies, etc.',
    default: false,
    parameter: null,
    type: null,
  },
  'updateNotes': {
    shortHand: 'n',
    description: 'Update notes from local file',
    default: false,
    parameter: null,
    type: null,
  },
  'skipGameUpdates': {
    shortHand: 's',
    description: 'Skip updating game data (OpenCritic, Steam, Metacritic)',
    default: false,
    parameter: null,
    type: null,
  },
  'help': {
    shortHand: 'h',
    description: 'Display help message',
    default: false,
    parameter: null,
    type: null,
  }
});

if (args.get('help')) {
  args.displayHelp();
  process.exit(0);
}

const fetchDelay = 0; // ms
const startIndex = args.get('startIndex') as number;
const forceFetchTitle = args.get('fetchTitle') as string;
const refetchAge = forceFetchTitle ? -1 : args.get('refetchAge') as number;
const updatePurchases = args.get('updatePurchases') as boolean;
const updateProgress = args.get('updateProgress') as boolean;
const updateNotes = args.get('updateNotes') as boolean;
const skipGameUpdates = args.get('skipGameUpdates') as boolean;
const updateLoop = async (): Promise<void> => {
  const databaseFilePath = `${process.env.SOURCE_DIR}${GameDatabaseService.GAME_DATABASE_FILE}`;
  const database = await GameDatabaseService.initDatabase(databaseFilePath);

  const [purchasedGames] = await getGameLibraryData(database, {
    progress: !updateProgress,
    purchases: !updatePurchases,
    notes: !updateNotes
  });

  if (skipGameUpdates) {
    process.stdout.write(colorize('Skipping game updates.\n', 'cyan'));
    lineReader.close();
    process.exit(0);
  }

  const gameTitles: Record<string, string> = {};
  purchasedGames.forEach(game => {
    gameTitles[game.key] = game.title;
  });
  const sortedGameKeys = Object.keys(gameTitles).sort();

  process.stdout.write('\nUpdating Game Library... ');

  let i = 0;
  for (const gameKey of sortedGameKeys) {
    const title = gameTitles[gameKey];

    if ((forceFetchTitle && title !== forceFetchTitle) || i < startIndex) {
      i++;
      continue;
    }

    let game = database.getGameByTitle(title);

    process.stdout.write(`\n(${i}/${sortedGameKeys.length}) ${colorize(game.title, 'green')}\n`);

    if (!game.openCriticId) {
      const openCriticId = await lineReader.askQuestion('OpenCritic ID (skip): ');
      game = database.updateGame(game, { openCriticId: openCriticId || 'skip' });
    }
    let openCriticWasFetched = false;
    const openCriticDataAge = game.openCriticData ? calculateTimeDifference(new Date(game.openCriticData.updated)) : null;
    if (game.openCriticId && game.openCriticId.match(/\d+\/.*/) && ((!openCriticDataAge && openCriticDataAge !== 0) || openCriticDataAge > refetchAge)) {
      const openCriticData = await fetchOpenCriticData(game.openCriticId);
      if (openCriticData) {
        game = database.updateGame(game, { openCriticData });
        openCriticWasFetched = true;
      }
    }
    const colorizedScore = game.openCriticData?.score ? colorize(`${game.openCriticData.score}`, 'yellow') : colorize('N/A', 'red');
    const colorizedCritics = game.openCriticData?.critics ? colorize(`${game.openCriticData.critics}%`, 'yellow') : colorize('N/A', 'red');
    process.stdout.write(`OpenCritic Score: ${colorizedScore} (${colorizedCritics}) ${openCriticWasFetched ? '(fetched)' : ''}\n`);


    if (!game.steamAppId) {
      const steamAppId = await lineReader.askQuestion('Steam App ID (skip): ');
      game = database.updateGame(game, { steamAppId: !steamAppId || steamAppId === 'skip' ? -1 : parseInt(steamAppId, 10) });
    }
    let steamDataWasFetched = false;
    let proposedMetacriticUrl: string | null = null;
    const steamDataAge = game.steamData ? calculateTimeDifference(new Date(game.steamData.updated)) : null;
    if (game.steamAppId && game.steamAppId !== -1 && ((!steamDataAge && steamDataAge !== 0) || steamDataAge > refetchAge)) {
      const steamData = await fetchSteamData(game.steamAppId);
      if (steamData) {
        if (steamData.metacriticUrl && !game.metacriticUrl) {
          proposedMetacriticUrl = steamData.metacriticUrl.replace(/\?.*/, '').replace(/\/pc\//, '/');
        }
        delete steamData.metacriticUrl;
        game = database.updateGame(game, { steamData });
        steamDataWasFetched = true;
      }
    }
    const colorizedReviewDescription = game.steamData?.reviewScoreDescription ? colorize(game.steamData.reviewScoreDescription, 'yellow') : colorize('N/A', 'red');
    process.stdout.write(`Steam Score: ${colorizedReviewDescription} ${steamDataWasFetched ? '(fetched)' : ''}\n`);

    if (!game.metacriticUrl) {
      const defaultMetacriticUrl = proposedMetacriticUrl || 'skip';
      const metacriticUrl = await lineReader.askQuestion(`Metacritic URL (${defaultMetacriticUrl}): `);
      game = database.updateGame(game, { metacriticUrl: metacriticUrl || defaultMetacriticUrl });
    }
    let metacriticDataWasFetched = false;
    const metacriticDataAge = game.metacriticData ? calculateTimeDifference(new Date(game.metacriticData.updated)) : null;
    if (game.metacriticUrl && game.metacriticUrl !== 'skip' && ((!metacriticDataAge && metacriticDataAge !== 0) || metacriticDataAge > refetchAge)) {
      const metacriticData = await fetchMetacriticData(game.metacriticUrl);
      if (metacriticData) {
        game = database.updateGame(game, { metacriticData });
        metacriticDataWasFetched = true;
      }
    }
    const colorizedMetacriticScore = game.metacriticData?.metacriticScore ? colorize(`${game.metacriticData.metacriticScore}`, 'yellow') : colorize('N/A', 'red');
    process.stdout.write(`Metacritic Score: ${colorizedMetacriticScore} ${metacriticDataWasFetched ? '(fetched)' : ''}\n`);

    if (!game.openCriticData && !game.steamData && !game.metacriticData && !game.releaseDate) {
      const releaseDate = await lineReader.askQuestion('Release Date: ');
      if (!releaseDate) {
        throw new Error('Release date is required');
      }
      game.releaseDate = new Date(releaseDate).toISOString();
    }
    if (game.openCriticData?.releaseDate) {
      process.stdout.write(`Release Date: ${colorize(game.openCriticData.releaseDate, 'cyan')} (OpenCritic)\n`);
    }
    else if (game.steamData?.releaseDate) {
      process.stdout.write(`Release Date: ${colorize(game.steamData.releaseDate, 'cyan')} (Steam)\n`);
    }
    else if (game.metacriticData?.releaseDate) {
      process.stdout.write(`Release Date: ${colorize(game.metacriticData.releaseDate, 'cyan')} (Metacritic)\n`);
    }
    else if (game.releaseDate) {
      process.stdout.write(`Release Date: ${colorize(game.releaseDate, 'cyan')}\n`);
    }

    await database.save(databaseFilePath);

    if (fetchDelay) await new Promise(resolve => setTimeout(resolve, fetchDelay));

    i++;
  }

  lineReader.close();
  process.exit(0);
};

updateLoop().catch(error => {
  console.error('Error in update loop:', error);
  process.exit(1);
});

