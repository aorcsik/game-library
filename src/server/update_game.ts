import fs from 'fs';
import { colorize, LineReader } from './tools';
import GameDatabaseService from './GameDatabaseService';
import { fetchMetacriticData, fetchOpenCriticData, fetchSteamData } from './ReviewFetcherService';

process.env.TZ = 'UTC';

const lineReader = new LineReader();

const fetchDelay = 0; // ms
let refetchAge = 14; // days
let startIndex = 0;
let forceFetchTitle: string | null = null;
if (process.argv[2] === '-i' && process.argv[3]) {
  startIndex = parseInt(process.argv[3], 10);
  if (isNaN(startIndex)) {
    console.error('Invalid start index');
    process.exit(1);
  }
} else if (process.argv[2] === '-t' && process.argv[3]) {
  forceFetchTitle = process.argv[3];
  refetchAge = -1;
}

const calculateTimeDifference = (startDate: Date, endDate?: Date): number => {
  if (!endDate) {
    endDate = new Date();
  }
  const diff = endDate.getTime() - startDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const updateLoop = async (): Promise<void> => {
  const databaseFilePath = `${process.env.SOURCE_DIR}/games.json`;

  const database = await GameDatabaseService.initDatabase(databaseFilePath);

  const gameTitlesFile = await fs.promises.readFile(`${process.env.SOURCE_DIR}/game-titles.json`, 'utf-8');
  const gameTitles = JSON.parse(gameTitlesFile.toString()) as Record<string, string>;
  const sortedGameKeys = Object.keys(gameTitles).sort();

  let i = 0;
  for (const gameKey of sortedGameKeys) {
    const title = gameTitles[gameKey];

    if (forceFetchTitle && title !== forceFetchTitle) continue;
    if (i < startIndex) continue;

    let game = database.getGameByTitle(title);

    process.stdout.write(`\n(${i}/${sortedGameKeys.length}) ${colorize(game.title, 'green')}\n`);

    if (!game.openCriticId) {
      const openCriticId = await lineReader.askQuestion('OpenCritic ID (skip): ');
      game = database.updateGame(game, { openCriticId: openCriticId || 'skip' });
    }
    let openCriticWasFetched = false;
    const openCriticDataAge = game.openCriticData ? calculateTimeDifference(new Date(game.openCriticData.updated)) : null;
    if (game.openCriticId && game.openCriticId.match(/\d+\/.*/) && (!openCriticDataAge || openCriticDataAge > refetchAge)) {
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
    if (game.steamAppId && game.steamAppId !== -1 && (!steamDataAge || steamDataAge > refetchAge)) {
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
    if (game.metacriticUrl && game.metacriticUrl !== 'skip' && (!metacriticDataAge || metacriticDataAge > refetchAge)) {
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

