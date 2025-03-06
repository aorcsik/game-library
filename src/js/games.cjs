const fs = require('fs');
const config = require('../../config.cjs');

// const formatTitle = (title) => {
//   return title.replace(/[™®]/, "");
// };

const skipTitle = [
// Playstation
  "HBO GO",
  "Spotify",
  "Netflix",
  "YouTube",
  "The Art of Detroit: Become Human™",
  "Detroit: Become Human™ Digital Deluxe Soundtrack",
  "WipEout™ digital art book",
  "EA Play Hub",
  "Prime Video",
  "Media Player",
  "DEATH STRANDING DIRECTOR'S CUT Bonus Content",
  "Shadow of the Tomb Raider - Original Soundtrack",
  "Little Nightmares II - Original Soundtrack",
  "The Art of Little Nightmares II",
  "The Matrix Awakens: An Unreal Engine 5 Experience",
  "The Art of Horizon Zero Dawn™",
  "The Art of God of War™",
  "God of War™ Digital Comic: Issue #0",
  "Twitch",
// Steam
  "Aseprite",
  "Mass Effect 2 (2010)",
  "Indie Game: The Movie",
  "Vessel Demo",
];

const gameCollections = {
  "The Alto Collection": [
    {"title": "Alto's Adventure"},
    {"title": "Alto's Odyssey"}
  ],
  "FRAMED Collection": [
    {"title": "FRAMED"},
    {"title": "FRAMED 2"}
  ]
};

const formatTitle = (title) => {
  title = title.replace("Ⓡ", "®");
  return title;
}

const generateGamesData = async () => {
  process.stdout.write("Games\n");

  const games = {};

  const platforms = {
    steam: { name: "Steam", count: 0 },
    playstation: { name: "PlayStation", count: 0 },
    switch: { name: "Nintendo Switch", count: 0 },
    epic: { name: "Epic Games", count: 0 },
    gog: { name: "Good Old Games", count: 0 },
    amazon: { name: "Prime Gaming", count: 0 },
    appstore: { name: "Apple App Store", count: 0 },
  };

  const gamesConfig = JSON.parse(await fs.promises.readFile("./games.json"));
  const findGameConfig = (title) => {
    return gamesConfig.filter(gameConfig => gameConfig.title === title || (gameConfig.sameGame && gameConfig.sameGame.includes(title))).pop();
  };
  const createGameSlug = (title) => {
    return title.replace(/^(A|An|The) (.*)$/, "$2, $1").replaceAll(/[^A-Za-z0-9]/g, "").toLowerCase();
  };
  const getGameConfig = (title) => {
    const gameConfig = findGameConfig(title);
    return {
      title: title,
      key: createGameSlug(gameConfig ? gameConfig.title : title),
      ...gameConfig
    };
  };
  const updateGameConfig = async (title, gameConfigUpdates) => {
    const gameConfig = findGameConfig(title);
    if (gameConfig) {
      Object.keys(gameConfigUpdates).forEach(key => {
        gameConfig[key] = gameConfigUpdates[key];
      });
    }
  };

  const steam_api_response = await fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${config.steam_api_key}&steamid=${config.steam_id}&include_appinfo=1&format=json`);
  const steam_data = await steam_api_response.json();
  steam_data.response.games.forEach(element => {
    if (skipTitle.includes(element.name)) return;

    const title = formatTitle(element.name);
    if (gameCollections[element.name]) {
      gameCollections[element.name].forEach(collectionItem => {
        const collectionTitle = formatTitle(collectionItem.title);
        updateGameConfig(collectionTitle, { steamAppId: element.appid });
        const gameConfig = getGameConfig(collectionTitle);
        if (!games[gameConfig.key]) games[gameConfig.key] = gameConfig;
        games[gameConfig.key].steam = collectionTitle;
        games[gameConfig.key].steam_collection = title;
        games[gameConfig.key].steam_cover = `https://steamcdn-a.akamaihd.net/steam/apps/${element.appid}/header.jpg`;
        games[gameConfig.key].steam_icon = `http://media.steampowered.com/steamcommunity/public/images/apps/${element.appid}/${element.img_icon_url}.jpg`;
        platforms.steam.count++;
      });
    } else {
      updateGameConfig(title, { steamAppId: element.appid });
      const gameConfig = getGameConfig(title);
      if (!games[gameConfig.key]) games[gameConfig.key] = gameConfig;
      games[gameConfig.key].steam = title;
      games[gameConfig.key].steam_cover = `https://steamcdn-a.akamaihd.net/steam/apps/${element.appid}/header.jpg`;
      games[gameConfig.key].steam_icon = `http://media.steampowered.com/steamcommunity/public/images/apps/${element.appid}/${element.img_icon_url}.jpg`;
      platforms.steam.count++;
    }
  });

  const epic_data = JSON.parse(await fs.promises.readFile(config.epic_library));
  epic_data.library.forEach(element => {
    if (element.install.is_dlc) {
      // console.log("DLC", element.title);
      return;
    }

    const title = formatTitle(element.title);
    const gameConfig = getGameConfig(title);
    if (!games[gameConfig.key]) games[gameConfig.key] = gameConfig;
    games[gameConfig.key].epic = title;
    games[gameConfig.key].epic_cover = element.art_cover;
    platforms.epic.count++;
  });

  const amazon_data = JSON.parse(await fs.promises.readFile(config.amazon_library));
  amazon_data.library.forEach(element => {
    if (element.install.is_dlc) {
      // console.log("DLC", element.title);
      return;
    }

    const title = formatTitle(element.title);
    const gameConfig = getGameConfig(title);
    if (!games[gameConfig.key]) games[gameConfig.key] = gameConfig;
    games[gameConfig.key].amazon = title;
    games[gameConfig.key].amazon_cover = element.art_cover;
    platforms.amazon.count++;
  });

  const gog_data = JSON.parse(await fs.promises.readFile(config.gog_library));
  gog_data.games.forEach(element => {
    if (element.install.is_dlc) {
      // console.log("DLC", element.title);
      return;
    }
 
    const title = formatTitle(element.title);
    const gameConfig = getGameConfig(title);
    if (!games[gameConfig.key]) games[gameConfig.key] = gameConfig;
    games[gameConfig.key].gog = title;
    games[gameConfig.key].gog_cover = element.art_cover;
    platforms.gog.count++;
  });

  const nintendo_data = JSON.parse(await fs.promises.readFile(config.nintendo_library));
  Object.keys(nintendo_data).forEach(purchase => {
    nintendo_data[purchase].forEach(element => {
      const title = formatTitle(element.title);
      const gameConfig = getGameConfig(title);
      if (!games[gameConfig.key]) games[gameConfig.key] = gameConfig;
      games[gameConfig.key].switch = title;
      games[gameConfig.key].switch_cover = element.cover;
      platforms.switch.count++;
    });
  });

  const appstore_data = JSON.parse(await fs.promises.readFile(config.appstore_library));
  Object.keys(appstore_data).forEach(purchase => {
    appstore_data[purchase].forEach(element => {
      const title = formatTitle(element.title);
      const gameConfig = getGameConfig(title);
      if (!games[gameConfig.key]) games[gameConfig.key] = gameConfig;
      games[gameConfig.key].appstore = title;
      games[gameConfig.key].appstore_cover = element.cover;
      platforms.appstore.count++;
    });
  });

  const playstation_data = JSON.parse(await fs.promises.readFile(config.playstation_library));
  playstation_data.purchases.forEach(page => {
    page.forEach(purchase => {
      if (skipTitle.includes(purchase.titleName)) return;

      const title = formatTitle(purchase.titleName);
      if (playstation_data.collections[purchase.titleName]) {
        playstation_data.collections[purchase.titleName].forEach(collectionItem => {
          const collectionTitle = formatTitle(collectionItem.titleName);
          const gameConfig = getGameConfig(collectionTitle);
          if (!games[gameConfig.key]) {
            games[gameConfig.key] = gameConfig;
          }
          if (!games[gameConfig.key].playstation_generation) {
            games[gameConfig.key].playstation_generation = [];
          }
          games[gameConfig.key].playstation = collectionTitle;
          games[gameConfig.key].playstation_collection = title;
          games[gameConfig.key].playstation_cover = purchase.cover;
          games[gameConfig.key].playstation_plus = games[gameConfig.key].playstation_plus === false ? false : purchase.serviceUpsell === "PS PLUS";
          games[gameConfig.key].playstation_generation.push(purchase.platform);
          platforms.playstation.count++;
        });
      } else {
        const gameConfig = getGameConfig(title);
        if (!games[gameConfig.key]) {
          games[gameConfig.key] = gameConfig;
        }
        if (!games[gameConfig.key].playstation_generation) {
          games[gameConfig.key].playstation_generation = [];
        }
        games[gameConfig.key].playstation = title;
        games[gameConfig.key].playstation_cover = purchase.cover;
        games[gameConfig.key].playstation_plus = games[gameConfig.key].playstation_plus === false ? false : purchase.serviceUpsell === "PS PLUS";
        games[gameConfig.key].playstation_generation.push(purchase.platform);
        platforms.playstation.count++;
      }
    });
  });

  let playstationPlusCount = 0;
  Object.keys(games).forEach(key => {
    if (games[key].playstation_plus) playstationPlusCount++;
  });

  const gameGridHeader = Object.keys(platforms).map(platform => {
    const title = platform === "playstation" ? `${platforms[platform].count} games (${playstationPlusCount} in PS Plus Library)` : `${platforms[platform].count} games`;
    return `<h2 class="game-header-cell platform-${platform}" data-game-platform="${platform}">
      <img class="game-platform" alt="${platforms[platform].name}" src="images/${platform}-logo.svg">
      <strong>${platforms[platform].name}</strong>
      <span class="platform-count" title="${title}">${platforms[platform].count}</span>
    </h2>`;
  });

  let gameGrid = `
  <div class="games-header">
    ${gameGridHeader.join("\n")}
  </div>
  `;

  const getReleaseDate = (game) => {
    if (game.openCriticData && game.openCriticData.releaseDate) {
      return game.openCriticData.releaseDate;
    }
    if (game.steamData && game.steamData.releaseDate) {
      return game.steamData.releaseDate;
    }
    if (game.releaseDate) {
      return game.releaseDate;
    }
    return "";
  };

  Object.keys(games).sort().forEach(key => {
    gameGrid += `
    <div id="game_${key}" class="game-row" data-game-title="${games[key].title}"
      data-open-critic-id="${games[key].openCriticId ? games[key].openCriticId : ""}"
      data-game-release-date="${getReleaseDate(games[key])}"
      data-open-critic-tier="${games[key].openCriticData && games[key].openCriticData.tier ? games[key].openCriticData.tier : "n-a"}"
      data-open-critic-score="${games[key].openCriticData && games[key].openCriticData.score ? games[key].openCriticData.score : ""}"
      data-open-critic-critics="${games[key].openCriticData && games[key].openCriticData.critics ? games[key].openCriticData.critics : ""}"
      data-steam-app-id="${games[key].steamAppId ? games[key].steamAppId : ""}"
      data-steam-genres="${games[key].steamData && games[key].steamData.genres ? games[key].steamData.genres.join(",") : ""}"
      data-steam-review-score="${games[key].steamData && games[key].steamData.reviewScore ? games[key].steamData.reviewScore : ""}"
      data-steam-review-score-description="${games[key].steamData && games[key].steamData.reviewScoreDescription ? games[key].steamData.reviewScoreDescription : ""}"
      data-metacritic-score="${games[key].steamData && games[key].steamData.metacriticScore ? games[key].steamData.metacriticScore : ""}"
      data-metacritic-url="${games[key].steamData && games[key].steamData.metacriticUrl ? games[key].steamData.metacriticUrl : ""}"
    >`;
    Object.keys(platforms).forEach(platform => {
      if (games[key][platform]) {
        const title = games[key][platform];
        const cover = games[key][platform + "_cover"];
        const collection = games[key][platform + "_collection"];

        const platformLogo = platform === "playstation" && games[key].playstation_plus ? "psplus" : platform;

        gameGrid += `
        <div class="game-cell game-card game-${platform}">
          <div class="game-cover"><div class="game-cover-image" style="background-image: url('${cover}');"></div></div>
          <div class="game-info">
            <div class="game-title">${title}${collection ? "<div class='game-collection'>(" + collection + ")</div>" : ""}</div>
            <img class="game-platform" alt="${platforms[platform].name}" src="images/${platformLogo}-logo.svg">
          </div>
        </div>`;
      } else {
        gameGrid += `
        <div class="game-cell game-placeholder game-${platform}">
          <div class="game-info">
            <img class="game-platform" alt="${platforms[platform].name}" src="images/${platform}-logo.svg">
          </div>
        </div>`;
      }  
    });
    gameGrid += `
    </div>`;
  });

  const template = await fs.promises.readFile("./template.html");
  let html = template.toString().replace("{{game-grid}}", gameGrid);

  await fs.promises.writeFile("./games.json", JSON.stringify(gamesConfig, null, 2));
  
  await fs.promises.writeFile("docs/index.html", html);
  await fs.promises.writeFile("docs/games.json", JSON.stringify(games, null, 2));
};

module.exports = generateGamesData;