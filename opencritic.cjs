const fs = require("fs");
const { release } = require("os");
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

(async () => {

  const games = JSON.parse(await fs.promises.readFile("./docs/games.json"));

  const gamesConfig = JSON.parse(await fs.promises.readFile("./games.json"));

  if (process.argv[2] === "--next") {
    const sortedGameKeys = Object.keys(games).sort();
    for (let i in sortedGameKeys) {
      const gameConfig = gamesConfig.find(game => game.title === games[sortedGameKeys[i]].title);

      if (!gameConfig || !gameConfig.openCriticId) {
        console.log(`(${i}/${sortedGameKeys.length})`, games[sortedGameKeys[i]]);
        const openCriticId = await askQuestion("OpenCritic ID (skip): ");
        if (!openCriticId || openCriticId === "skip") {
          const releaseDate = await askQuestion("Release Date (skip): ");
          const gameConfig = gamesConfig.find(game => game.title === games[sortedGameKeys[i]].title);
          if (!gameConfig) {
            gamesConfig.push({ 
              title: games[sortedGameKeys[i]].title,
              openCriticId: "skip",
              releaseDate: releaseDate ? new Date(releaseDate).toISOString() : null,
            });
          } else {
            gameConfig.openCriticId = "skip";
            gameConfig.releaseDate = releaseDate ? new Date(releaseDate).toISOString() : null;
          }
        } else if (openCriticId.match(/\d+\/.*/)) {
          const openCriticData = await fetchOpenCriticData(openCriticId);
          const gameConfig = gamesConfig.find(game => game.title === games[sortedGameKeys[i]].title);
          if (!gameConfig) {
            gamesConfig.push({ 
              title: games[sortedGameKeys[i]].title,
              openCriticId,
              openCriticData
            });
          } else {
            gameConfig.openCriticId = openCriticId;
            gameConfig.openCriticData = openCriticData;
          }
          if (!openCriticData.releaseDate) {
            const releaseDate = await askQuestion("Release Date: ");
            const gameConfig = gamesConfig.find(game => game.title === games[sortedGameKeys[i]].title);
            gameConfig.releaseDate = releaseDate ? new Date(releaseDate).toISOString() : null;
          }
        }

        await fs.promises.writeFile("./games.json", JSON.stringify(gamesConfig, null, 2));
        const gameConfig = gamesConfig.find(game => game.title === games[sortedGameKeys[i]].title);
        console.log(gameConfig);
      } else if (!gameConfig.releaseDate && (gameConfig.openCriticId === "skip" || !gameConfig.openCriticData.releaseDate)) {
        console.log(`(${i}/${sortedGameKeys.length})`, games[sortedGameKeys[i]]);
        const releaseDate = await askQuestion("Release Date: ");
        gameConfig.releaseDate = releaseDate ? new Date(releaseDate).toISOString() : null;
        await fs.promises.writeFile("./games.json", JSON.stringify(gamesConfig, null, 2));
      }
    }
  }

  if (process.argv[2] === "--add") {

    const title = process.argv[3];
    const openCriticId = process.argv[4];
    
    if (!gamesConfig.find(game => game.title === title)) {
      gamesConfig.push({ title, openCriticId });
    }

    const gameConfig = gamesConfig.find(game => game.title === title);
    gameConfig.openCriticId = openCriticId;

    if (process.argv.length > 5) {
      for (let i = 5; i < process.argv.length; i += 1) {
        if (!gameConfig.sameGame) {
          gameConfig.sameGame = [];
        }
        gameConfig.sameGame.push(process.argv[i]);
      }
    }

  }

  if (process.argv[2] === "--update" || process.argv[2] === "--add") {

    for (let i in gamesConfig) {
      if (!process.argv[3] || gamesConfig[i].title === process.argv[3]) {
        if (gamesConfig[i].openCriticId && gamesConfig[i].openCriticId !== "skip") {
          if (true || !gamesConfig[i].openCriticData || new Date(gamesConfig[i].openCriticData.updated) < new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 7)) {
            gamesConfig[i].openCriticData = await fetchOpenCriticData(gamesConfig[i].openCriticId);
            await fs.promises.writeFile("./games.json", JSON.stringify(gamesConfig, null, 2));
            console.log("updated", gamesConfig[i].title, gamesConfig[i].openCriticData);
          } else {
            console.log("skipped", gamesConfig[i].title, gamesConfig[i].openCriticData);
          }
        }
      }
    }

  }

  rl.close();

})();