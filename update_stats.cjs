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

const fetchOpenCriticData = async (openCriticId) => {
  const openCriticResponse = await fetch(`https://opencritic.com/game/${openCriticId}`);
  const gamePage = await openCriticResponse.text();
  const dom = new JSDOM(gamePage);


  const coverElement = dom.window.document.querySelector('.header-card picture source[media="(max-width: 991px)"]');
  const tierElement = dom.window.document.querySelector(".header-card app-score-orb .score-orb svg circle");
  const scoreOrbs = [...dom.window.document.querySelectorAll(".header-card app-score-orb .inner-orb")];
  const releaseDateElement = dom.window.document.querySelector(".platforms");
  const releaseDate = releaseDateElement ? releaseDateElement.innerHTML.match(/Release Date:<\/strong> (.*) -/)[1] : null;
  return {
    tier: tierElement ? tierElement.className.baseVal : null,
    score: scoreOrbs.length > 0 ? parseInt(scoreOrbs[0].textContent, 10) : null,
    critics: scoreOrbs.length > 1 && scoreOrbs[1].textContent.trim().match(/\d+%/) ? parseInt(scoreOrbs[1].textContent, 10) : null,
    cover: coverElement ? coverElement.srcset : null,
    releaseDate: releaseDate ? new Date(releaseDate).toISOString() : null,
    updated: new Date().toISOString(),
  };
};

const fetchSteamData = async (steamAppId) => {
  const appDetailsResponse = await fetch(`https://store.steampowered.com/api/appdetails?appids=${steamAppId}`);
  const appDetails = await appDetailsResponse.json();
  
  const title = appDetails[steamAppId].data.name;
  const description = appDetails[steamAppId].data.short_description;
  const metacriticScore = appDetails[steamAppId].data.metacritic ? appDetails[steamAppId].data.metacritic.score : null;
  const metacriticUrl = appDetails[steamAppId].data.metacritic ? appDetails[steamAppId].data.metacritic.url : null;
  const genres = appDetails[steamAppId].data.genres.map(genre => genre.description);
  const releaseDate = new Date(appDetails[steamAppId].data.release_date.date).toISOString();
  const headerImage = appDetails[steamAppId].data.header_image;
  
  const appReviewResponse = await fetch(`https://store.steampowered.com/appreviews/${steamAppId}?json=1`);
  const appReview = await appReviewResponse.json();

  const reviewScore = appReview.query_summary.review_score;
  const reviewScoreDescription = appReview.query_summary.review_score_desc;

  return {
    title,
    description,
    metacriticScore,
    metacriticUrl,
    genres,
    releaseDate,
    reviewScore,
    reviewScoreDescription,
    headerImage,
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

  if (dom.window.document.querySelector(".apphub_AppName") === null || 
      dom.window.document.querySelector(".game_description_snippet") === null) {
    console.error("Error parsing Steam Store page", steamAppId);
    return null;
  }

  const title = dom.window.document.querySelector(".apphub_AppName").textContent.trim();
  const description = dom.window.document.querySelector(".game_description_snippet").textContent.trim();
  const metacriticScoreElement = dom.window.document.querySelector("#game_area_metascore .score");
  const metacriticScore = metacriticScoreElement ? parseInt(metacriticScoreElement.textContent, 10) : null;
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
    metacriticScore,
    metacriticUrl,
    genres,
    releaseDate,
    reviewScore,
    reviewScoreDescription,
    headerImage,
    updated: new Date().toISOString(),
  };
};

(async () => {

  const games = JSON.parse(await fs.promises.readFile("./docs/games.json"));

  const gamesConfig = JSON.parse(await fs.promises.readFile("./games.json"));

  const sortedGameKeys = Object.keys(games).sort();
  for (let i in sortedGameKeys) {
    console.log(`(${i}/${sortedGameKeys.length})`, games[sortedGameKeys[i]].title);

    if (gamesConfig.find(game => game.title === games[sortedGameKeys[i]].title) === undefined) {
      gamesConfig.push({ title: games[sortedGameKeys[i]].title });
    }
    const gameConfig = gamesConfig.find(game => game.title === games[sortedGameKeys[i]].title);

    if (!gameConfig.openCriticId) {
      if (!gameConfig.openCriticId) {
        const openCriticId = await askQuestion("OpenCritic ID (skip): ");
        gameConfig.openCriticId = openCriticId || "skip";
      }
    }
    if (!gameConfig.openCriticData && gameConfig.openCriticId.match(/\d+\/.*/)) {
      const openCriticData = await fetchOpenCriticData(gameConfig.openCriticId);
      gameConfig.openCriticData = openCriticData;
    }
    if (!gameConfig.steamAppId) {
      if (!gameConfig.steamAppId) {
        const steamAppId = await askQuestion("Steam App ID (skip): ");
        gameConfig.steamAppId = !steamAppId || steamAppId === "skip" ? -1 : parseInt(steamAppId, 10);
      }
    }
    if (gameConfig.steamAppId !== -1 && (!gameConfig.steamData || !gameConfig.steamData.title)) {
      const steamData = await fetchSteamStorePage(gameConfig.steamAppId);
      if (steamData) gameConfig.steamData = steamData;
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!gameConfig.openCriticData && !gameConfig.steamData && !gameConfig.releaseDate) {
      const releaseDate = await askQuestion("Release Date: ");
      gameConfig.releaseDate = releaseDate ? new Date(releaseDate).toISOString() : null;
    }

    await fs.promises.writeFile("./games.json", JSON.stringify(gamesConfig, null, 2));
    const newGameConfig = gamesConfig.find(game => game.title === games[sortedGameKeys[i]].title);
    console.log(newGameConfig);

    // await askQuestion("Press Enter to continue...");
  }

  rl.close();

})();