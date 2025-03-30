const fs = require("fs");
const readline = require('readline');
const JSDOM = require("jsdom").JSDOM;

process.env.TZ = "UTC";

// Create an interface for input and output
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

// Color formatting utility function
const colorize = (text, color) => {
  const colorCodes = {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    brightBlack: '\x1b[90m',
    brightRed: '\x1b[91m',
    brightGreen: '\x1b[92m',
    brightYellow: '\x1b[93m',
    brightBlue: '\x1b[94m',
    brightMagenta: '\x1b[95m',
    brightCyan: '\x1b[96m',
    brightWhite: '\x1b[97m',
  };
  
  const reset = '\x1b[0m';
  
  if (!colorCodes[color]) {
    return text; // Return unmodified if color not found
  }
  
  return `${colorCodes[color]}${text}${reset}`;
};

const fetchOpenCriticData = async (openCriticId) => {
  const openCriticResponse = await fetch(`https://opencritic.com/game/${openCriticId}`);
  const gamePage = await openCriticResponse.text();
  const dom = new JSDOM(gamePage);

  const titleElement = dom.window.document.querySelector("app-game-overview h1");
  const title = titleElement ? titleElement.textContent.trim() : null;
  const coverElement = dom.window.document.querySelector('.header-card picture source[media="(max-width: 991px)"]');
  const cover = coverElement ? coverElement.srcset : null;
  const tierElement = dom.window.document.querySelector(".header-card app-score-orb .score-orb svg circle");
  const tier = tierElement ? tierElement.className.baseVal : null;
  const scoreOrbs = [...dom.window.document.querySelectorAll(".header-card app-score-orb .inner-orb")];
  const score = scoreOrbs.length > 0 ? parseInt(scoreOrbs[0].textContent, 10) : null;
  const critics = scoreOrbs.length > 1 && scoreOrbs[1].textContent.trim().match(/\d+%/) ? parseInt(scoreOrbs[1].textContent, 10) : null;
  const releaseDateElement = dom.window.document.querySelector(".platforms");
  const releaseDateMatch = releaseDateElement ? releaseDateElement.innerHTML.match(/Release Date:<\/strong> (\w+ \d+, \d+) -/) : null;
  const releaseDate = releaseDateMatch ? new Date(releaseDateMatch[1]).toISOString() : null;
  return {
    title,
    cover,
    tier,
    score,
    critics,
    releaseDate,
    updated: new Date().toISOString(),
  };
};

const fetchSteamStorePage = async (steamAppId) => {
  const steamStoreResponse = await fetch(`https://store.steampowered.com/app/${steamAppId}`, {
    headers: {
      'Cookie': 'birthtime=463096801; lastagecheckage=4-September-1984; wants_mature_content=1'
    }
  });

  if (!steamStoreResponse.ok || steamStoreResponse.url.match(new RegExp(`app\/${steamAppId}`)) === null) {
    console.error("Error fetching Steam Store page", steamAppId);
    return null;
  }

  const steamStorePage = await steamStoreResponse.text();
  const dom = new JSDOM(steamStorePage);

  // console.log(steamStorePage);

  if (dom.window.document.querySelector(".apphub_AppName") === null) {
    console.error("Error parsing Steam Store page", steamAppId);
    return null;
  }

  const title = dom.window.document.querySelector(".apphub_AppName").textContent.trim();
  const descriptionElement = dom.window.document.querySelector(".game_description_snippet");
  const description = descriptionElement ? descriptionElement.textContent.trim() : null;
  // const metacriticScoreElement = dom.window.document.querySelector("#game_area_metascore .score");
  // const metacriticScore = metacriticScoreElement ? parseInt(metacriticScoreElement.textContent, 10) : null;
  const metacriticUrlElement = dom.window.document.querySelector("#game_area_metalink a");
  const metacriticUrl = metacriticUrlElement ? metacriticUrlElement.href : null;
  const genresElement = dom.window.document.querySelector("#genresAndManufacturer");
  const genres = [...genresElement.querySelectorAll("a")].map(link => link.href.match(/genre\/(.*?)\//)).filter(match => match).map(match => match[1]);
  const releaseDateMatch = genresElement.textContent.match(/Release Date:\s*(\d+ \w+, \d+)/);
  const releaseDate = releaseDateMatch ? new Date(releaseDateMatch[1]).toISOString() : null;
  const reviewScoreElement = dom.window.document.querySelector(".user_reviews .game_review_summary");
  const reviewScoreDescription = reviewScoreElement ? reviewScoreElement.textContent.trim() : null;
  const reviewScoreMap = {
    "Overwhelmingly Positive": 9,
    "Very Positive": 8,
    "Positive": 7,
    "Mostly Positive": 6,
    "Mixed": 5,
    "Mostly Negative": 4,
    "Negative": 3,
    "Very Negative": 2,
    "Overwhelmingly Negative": 1,
  };
  const reviewScore = reviewScoreDescription ? reviewScoreMap[reviewScoreDescription] : null;
  const headerImage = dom.window.document.querySelector(".game_header_image_full").src;

  return {
    title,
    description,
    // metacriticScore,
    metacriticUrl,
    genres,
    releaseDate,
    reviewScore,
    reviewScoreDescription,
    headerImage,
    updated: new Date().toISOString(),
  };
};

const fetchMetacriticPage = async (metacriticUrl) => {
  const metacriticResponse = await fetch(metacriticUrl);
  if (!metacriticResponse.ok) {
    console.error("Error fetching Metacritic page", metacriticUrl);
    return null;
  }
  const metacriticPage = await metacriticResponse.text();

  // const metadata = metacriticPage.match(/k\.meta/);

  const dom = new JSDOM(metacriticPage);
  const title = dom.window.document.querySelector("h1").textContent.trim();
  const releaseDateMatch = dom.window.document.querySelector(".c-ProductHeroGamePlatformInfo + div").textContent.trim().match(/Released On:\s*(\w+ \d+, \d+)/);
  const releaseDate = releaseDateMatch ? new Date(releaseDateMatch[1]).toISOString() : null;
  const metacriticScoreElement = dom.window.document.querySelector(".c-productScoreInfo_scoreNumber");
  const metacriticScore = metacriticScoreElement && parseInt(metacriticScoreElement.textContent, 10) || null;
  // const heroImageElement = dom.window.document.querySelector(".c-productHero_playerContainer img");
  // const heroImage = heroImageElement ? heroImageElement.src : null;

  return {
    title,
    releaseDate,
    metacriticScore,
    // heroImage,
    updated: new Date().toISOString(),
  };
};

const fetchDelay = 250; // ms
let refetchAge = -1; // days
let startIndex = 0;
let forceFetchTitle = null;
if (process.argv[2] === "-i" && process.argv[3]) {
  startIndex = parseInt(process.argv[3], 10);
  if (isNaN(startIndex)) {
    console.error("Invalid start index");
    process.exit(1);
  }
} else if (process.argv[2] === "-t" && process.argv[3]) {
  forceFetchTitle = process.argv[3];
  refetchAge = -1;
}

(async () => {

  const games = JSON.parse(await fs.promises.readFile("./docs/games.json"));

  const gamesConfig = JSON.parse(await fs.promises.readFile("./games.json"));

  const sortedGameKeys = Object.keys(games).sort();
  for (let i in sortedGameKeys) {
    if (forceFetchTitle && games[sortedGameKeys[i]].title !== forceFetchTitle) continue;
    if (i < startIndex) continue;

    if (gamesConfig.find(game => game.title === games[sortedGameKeys[i]].title) === undefined) {
      gamesConfig.push({ title: games[sortedGameKeys[i]].title });
    }
    const gameConfig = gamesConfig.find(game => game.title === games[sortedGameKeys[i]].title);
    process.stdout.write(`\n(${i}/${sortedGameKeys.length}) ${colorize(gameConfig.title, 'green')}\n`);

    if (!gameConfig.openCriticId) {
      const openCriticId = await askQuestion("OpenCritic ID (skip): ");
      gameConfig.openCriticId = openCriticId || "skip";
    }
    let openCriticWasFetched = false;
    const openCriticDataAge = gameConfig.openCriticData ? (new Date() - new Date(gameConfig.openCriticData.updated)) / 1000 / 60 / 60 / 24 : null;
    if (gameConfig.openCriticId && gameConfig.openCriticId.match(/\d+\/.*/) && (!openCriticDataAge || openCriticDataAge > refetchAge)) {
      const openCriticData = await fetchOpenCriticData(gameConfig.openCriticId);
      if (openCriticData) {
        gameConfig.openCriticData = openCriticData;
        openCriticWasFetched = true;
      }
    }
    const colorizedScore = gameConfig.openCriticData && gameConfig.openCriticData.score ? colorize(gameConfig.openCriticData.score, 'yellow') : colorize("N/A", 'red');
    const colorizedCritics = gameConfig.openCriticData && gameConfig.openCriticData.critics ? colorize(gameConfig.openCriticData.critics, 'yellow') : colorize("N/A", 'red');
    process.stdout.write(`OpenCritic Score: ${colorizedScore} (${colorizedCritics}) ${openCriticWasFetched ? "(fetched)" : ""}\n`);


    if (!gameConfig.steamAppId) {
      const steamAppId = await askQuestion("Steam App ID (skip): ");
      gameConfig.steamAppId = !steamAppId || steamAppId === "skip" ? -1 : parseInt(steamAppId, 10);
    }
    let steamDataWasFetched = false;
    let proposedMetacriticUrl = null;
    const steamDataAge = gameConfig.steamData ? (new Date() - new Date(gameConfig.steamData.updated)) / 1000 / 60 / 60 / 24 : null;
    if (gameConfig.steamAppId !== -1 && (!steamDataAge || steamDataAge > refetchAge)) {
      const steamData = await fetchSteamStorePage(gameConfig.steamAppId);
      if (steamData) {
        if (steamData.metacriticUrl && !gameConfig.metacriticUrl) {
          proposedMetacriticUrl = steamData.metacriticUrl.replace(/\?.*/, "").replace(/\/pc\//, "/");
        }
        delete steamData.metacriticUrl;
        gameConfig.steamData = steamData;
        steamDataWasFetched = true;
      }
    }
    const colorizedReviewDescription = gameConfig.steamData && gameConfig.steamData.reviewScoreDescription ? colorize(gameConfig.steamData.reviewScoreDescription, 'yellow') : colorize("N/A", 'red');
    process.stdout.write(`Steam Score: ${colorizedReviewDescription} ${steamDataWasFetched ? "(fetched)" : ""}\n`);

    if (!gameConfig.metacriticUrl) {
      const defaultMetacriticUrl = proposedMetacriticUrl || "skip";
      const metacriticUrl = await askQuestion(`Metacritic URL (${defaultMetacriticUrl}): `);
      gameConfig.metacriticUrl = metacriticUrl || defaultMetacriticUrl;
    }
    let metacriticDataWasFetched = false;
    const metacriticDataAge = gameConfig.metacriticData ? (new Date() - new Date(gameConfig.metacriticData.updated)) / 1000 / 60 / 60 / 24 : null;
    if (gameConfig.metacriticUrl && gameConfig.metacriticUrl !== "skip" && (!metacriticDataAge || metacriticDataAge > refetchAge)) {
      const metacriticData = await fetchMetacriticPage(gameConfig.metacriticUrl);
      if (metacriticData) {
        gameConfig.metacriticData = metacriticData;
        metacriticDataWasFetched = true;
      }
    }
    const colorizedMetacriticScore = gameConfig.metacriticData && gameConfig.metacriticData.metacriticScore ? colorize(gameConfig.metacriticData.metacriticScore, 'yellow') : colorize("N/A", 'red');
    process.stdout.write(`Metacritic Score: ${colorizedMetacriticScore} ${metacriticDataWasFetched ? "(fetched)" : ""}\n`);

    if (!gameConfig.openCriticData && !gameConfig.steamData && !gameConfig.metacriticData && !gameConfig.releaseDate) {
      const releaseDate = await askQuestion("Release Date: ");
      gameConfig.releaseDate = releaseDate ? new Date(releaseDate).toISOString() : null;
    }
    if (gameConfig.openCriticData && gameConfig.openCriticData.releaseDate) {
      process.stdout.write(`Release Date: ${colorize(gameConfig.openCriticData.releaseDate, 'cyan')} (OpenCritic)\n`);
    }
    else if (gameConfig.steamData && gameConfig.steamData.releaseDate) {
      process.stdout.write(`Release Date: ${colorize(gameConfig.steamData.releaseDate, 'cyan')} (Steam)\n`);
    }
    else if (gameConfig.metacriticData && gameConfig.metacriticData.releaseDate) {
      process.stdout.write(`Release Date: ${colorize(gameConfig.metacriticData.releaseDate, 'cyan')} (Metacritic)\n`);
    }
    else if (gameConfig.releaseDate) {
      process.stdout.write(`Release Date: ${colorize(gameConfig.releaseDate, 'cyan')}\n`);
    }

    await fs.promises.writeFile("./games.json", JSON.stringify(gamesConfig, null, 2));
    const newGameConfig = gamesConfig.find(game => game.title === games[sortedGameKeys[i]].title);

    await new Promise(resolve => setTimeout(resolve, fetchDelay));
  }

  rl.close();

})();