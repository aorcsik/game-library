const fs = require('fs');
const config = require('./config.cjs');

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
  "Indie Game: The Movie"
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

const sameGames = [
  ["ABZÛ", "ABZU"],
  ["Aliens: Fireteam Elite", "Aliens: Fireteam Elite (PS5)"],
  ["Beholder", "Beholder: Complete Edition"],
  ["BioShock Infinite", "Bioshock Infinite: The Complete Edition"],
  ["Control", "Control Ultimate Edition"],
  ["Dead Island", "Dead Island - Definitive Edition"],
  ["Dead Island Riptide", "Dead Island: Riptide - Definitive Edition"],
  ["Diablo III", "Diablo III: Eternal Collection", "Diablo III: Reaper of Souls – Ultimate Evil Edition"],
  ["Ori and the Blind Forest", "Ori and the Blind Forest: Definitive Edition"],
  ["Overcooked", "Overcooked: Gourmet Edition"],
  ["Worms", "Worms United"],
  ["Grand Mountain Adventure", "Grand Mountain Adventure: Wonderlands"],
  ["Traffix", "Traffix: City Rush"],
  ["Pavilion", "Pavilion: Touch Edition"],
  ["Monument Valley 2", "Monument Valley 2: Panoramic Edition"],
  ["Mini Motor Racing", "Mini Motor Racing X"],
  ["INSIDE", "Playdead's INSIDE"],
  ["OXENFREE", "OXENFREE Mobile"],
  ["Manticore - Galaxy on Fire", "Galaxy on Fire 3"],
  ["This War of Mine", "This War of Mine: The Little Ones"],
  ["Never Alone (Kisima Ingitchuna)", "Never Alone: Ki Edition"],
  ["Perchang", "Perchang: A Portal Puzzler"],
  ["Hitman GO", "Hitman GO: Definitive Edition"],
  ["Don't Starve", "Don't Starve: Pocket Edition"],
  ["Syberia", "Syberia (FULL)"],
  ["Syberia 2", "Syberia 2 (FULL)"],
  ["Monument Valley", "Monument Valley: Panoramic Edition"],
  ["Republique", "République"],
  ["LIMBO", "Playdead's LIMBO"],
  ["Fetch™", "Fetch - A Boy and his Dog"],
  ["BADLAND", "BADLAND: Game of the Year Edition"],
  ["Azkend 2: The World Beneath", "Azkend 2: The Puzzle Adventure"],
  ["Broken Sword - Shadow of the Templars", "Broken Sword 1: Director's Cut"],
  ["Galaxy on Fire 2™ HD", "Galaxy on Fire 2™ Full HD"],
  ["EDGE", "EDGE Extended"],
  ["Another World", "Another World – 20th Anniversary Edition", "Another World - 20th"],
  ["Broken Sword 2 - the Smoking Mirror: Remastered (2010)", "Broken Sword 2: Remastered"],
  ["Superbrothers: Sword&Sworcery", "Superbrothers: Sword & Sworcery EP"],
  ["Middle-earth™: Shadow of Mordor™", "Middle-earth™: Shadow of Mordor™ - Game of the Year Edition"],
];

const createKey = (title) => {
  const sameGame = sameGames.filter(sameGame => sameGame.includes(title));
  title = sameGame[0] ? sameGame[0][0] : title;
  return title.replace(/^(A|An|The) (.*)$/, "$2, $1").replaceAll(/[^A-Za-z0-9]/g, "").toLowerCase();
};

const formatTitle = (title) => {
  title = title.replace("Ⓡ", "®");
  return title;
}

(async () => {
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

  const steam_api_response = await fetch(config.steam_library);
  const steam_data = await steam_api_response.json();
  steam_data.response.games.forEach(element => {
    if (skipTitle.includes(element.name)) return;

    const title = formatTitle(element.name);
    if (gameCollections[element.name]) {
      gameCollections[element.name].forEach(collectionItem => {
        const collectionTitle = formatTitle(collectionItem.title);
        const key = createKey(collectionTitle);
        if (!games[key]) games[key] = {};
        games[key].steam = collectionTitle;
        games[key].steam_collection = title;
        games[key].steam_cover = `https://steamcdn-a.akamaihd.net/steam/apps/${element.appid}/header.jpg`;
        games[key].steam_icon = `http://media.steampowered.com/steamcommunity/public/images/apps/${element.appid}/${element.img_icon_url}.jpg`;
        platforms.steam.count++;
      });
    } else {
      const key = createKey(title);
      if (!games[key]) games[key] = {};
      games[key].steam = title;
      games[key].steam_cover = `https://steamcdn-a.akamaihd.net/steam/apps/${element.appid}/header.jpg`;
      games[key].steam_icon = `http://media.steampowered.com/steamcommunity/public/images/apps/${element.appid}/${element.img_icon_url}.jpg`;
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
    const key = createKey(title);
    if (!games[key]) games[key] = {};
    games[key].epic = title;
    games[key].epic_cover = element.art_cover;
    platforms.epic.count++;
  });

  const amazon_data = JSON.parse(await fs.promises.readFile(config.amazon_library));
  amazon_data.library.forEach(element => {
    if (element.install.is_dlc) {
      // console.log("DLC", element.title);
      return;
    }

    const title = formatTitle(element.title);
    const key = createKey(title);
    if (!games[key]) games[key] = {};
    games[key].amazon = title;
    games[key].amazon_cover = element.art_cover;
    platforms.amazon.count++;
  });

  const gog_data = JSON.parse(await fs.promises.readFile(config.gog_library));
  gog_data.games.forEach(element => {
    if (element.install.is_dlc) {
      // console.log("DLC", element.title);
      return;
    }
 
    const title = formatTitle(element.title);
    const key = createKey(title);
    if (!games[key]) games[key] = {};
    games[key].gog = title;
    games[key].gog_cover = element.art_cover;
    platforms.gog.count++;
  });

  const nintendo_data = JSON.parse(await fs.promises.readFile(config.nintendo_library));
  Object.keys(nintendo_data).forEach(purchase => {
    nintendo_data[purchase].forEach(element => {
      const title = formatTitle(element.title);
      const key = createKey(title);
      if (!games[key]) games[key] = {};
      games[key].switch = title;
      games[key].switch_cover = element.cover;
      platforms.switch.count++;
    });
  });

  const appstore_data = JSON.parse(await fs.promises.readFile(config.appstore_library));
  Object.keys(appstore_data).forEach(purchase => {
    appstore_data[purchase].forEach(element => {
      const title = formatTitle(element.title);
      const key = createKey(title);
      if (!games[key]) games[key] = {};
      games[key].appstore = title;
      games[key].appstore_cover = element.cover;
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
          const key = createKey(collectionTitle);
          if (!games[key]) games[key] = {};
          games[key].playstation = collectionTitle;
          games[key].playstation_collection = title;
          games[key].playstation_cover = purchase.cover;
          platforms.playstation.count++;
        });
      } else {
        const key = createKey(title);
        if (!games[key]) games[key] = {};
        games[key].playstation = title;
        games[key].playstation_cover = purchase.cover;
        platforms.playstation.count++;
      }
    });
  });

  const gameGridHeader = Object.keys(platforms).map(platform => {
    return `<h2 class="game-header-cell">
      <img class="game-platform" alt="${platforms[platform]}" src="images/${platform}-logo.svg">
      <strong>${platforms[platform].name}</strong>
      <span class="platform-count">${platforms[platform].count}</span>
    </h2>`;
  });

  let gameGrid = `
  <div class="games-header">
    ${gameGridHeader.join("\n")}
  </div>
  `;

  Object.keys(games).sort().forEach(key => {
    gameGrid += `
    <div id="game_${key}" class="game-row">`;
    Object.keys(platforms).forEach(platform => {
      if (games[key][platform]) {
        const title = games[key][platform];
        const cover = games[key][platform + "_cover"];
        const collection = games[key][platform + "_collection"];

        gameGrid += `
        <div class="game-cell game-card game-${platform}">
          <div class="game-cover" style="background-image: url('${cover}');"></div>
          <div class="game-info">
            <div class="game-title">${title}${collection ? "<div class='game-collection'>(" + collection + ")</div>" : ""}</div>
            <img class="game-platform" alt="${platforms[platform]}" src="images/${platform}-logo.svg">
          </div>
        </div>`;
      } else {
        gameGrid += `
        <div class="game-cell game-placeholder game-${platform}">
          <div class="game-info">
            <img class="game-platform" alt="${platforms[platform]}" src="images/${platform}-logo.svg">
          </div>
        </div>`;
      }  
    });
    gameGrid += `
    </div>`;
  });

  const template = await fs.promises.readFile("./template.html");
  let html = template.toString().replace("{{game-grid}}", gameGrid);
  await fs.promises.writeFile("docs/index.html", html);

})();