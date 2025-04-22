import fs from 'fs';
import { getGameLibraryConfig } from './Config';
import GameDatabaseService from './GameDatabaseService';
import PurchaseService, { PlatformList, PlatformPurchse, PurchasedGame } from './PurchaseService';
import renderGameGrid from './views/GameGrid';
import { GamerProfile } from './schema';

const skipTitle = [
// Playstation
  'HBO GO',
  'Spotify',
  'Netflix',
  'YouTube',
  'The Art of Detroit: Become Human™',
  'Detroit: Become Human™ Digital Deluxe Soundtrack',
  'WipEout™ digital art book',
  'EA Play Hub',
  'Prime Video',
  'Media Player',
  "DEATH STRANDING DIRECTOR'S CUT Bonus Content",
  'Shadow of the Tomb Raider - Original Soundtrack',
  'Little Nightmares II - Original Soundtrack',
  'The Art of Little Nightmares II',
  'The Matrix Awakens: An Unreal Engine 5 Experience',
  'The Art of Horizon Zero Dawn™',
  'The Art of God of War™',
  'God of War™ Digital Comic: Issue #0',
  'Twitch',
// Steam
  'Aseprite',
  'Mass Effect 2 (2010)',
  'Indie Game: The Movie',
  'Vessel Demo',
  'The Whispered World',
  'Serious Sam Fusion 2017 (beta)',
// Epic
  'Mortal Shell Tech Beta',
  'KillingFloor2Beta'
];

const generateGamesData = async (path: string): Promise<void> => {
  const config = getGameLibraryConfig();

  const database = await GameDatabaseService.initDatabase(`${process.env.SOURCE_DIR}${GameDatabaseService.GAME_DATABASE_FILE}`);

  const profileFile = await fs.promises.readFile(`${process.env.SOURCE_DIR}${GameDatabaseService.PROFILE_FILE}`, 'utf-8');
  const profile = JSON.parse(profileFile.toString()) as GamerProfile;

  const purchaseService = new PurchaseService(config, database, skipTitle);

  const purchasedGames: PurchasedGame[] = [];

  const platforms: PlatformList = {
    steam: { name: 'Steam', count: 0 },
    playstation: { name: 'PlayStation', count: 0, plus: 0 },
    switch: { name: 'Nintendo Switch', count: 0 },
    epic: { name: 'Epic Games', count: 0 },
    gog: { name: 'Good Old Games', count: 0 },
    amazon: { name: 'Prime Gaming', count: 0 },
    appstore: { name: 'Apple App Store', count: 0 },
  };

  const addPurchases = <T extends Record<string, PlatformPurchse>>(purchases: T): void => {
    Object.keys(purchases).forEach(key => {
      const platform = purchases[key].platform;
      const purchasedGame = purchasedGames.find(p => p.key === key);
      if (purchasedGame) {
        purchasedGame.purchases.push(purchases[key]);
      } else {
        purchasedGames.push({
          ...database.getGameByTitle(purchases[key].title),
          purchases: [purchases[key]],
        });
      }
      platforms[platform].count++;
      if (platform === 'playstation' && purchases[key].plus) {
        if (platforms[platform].plus === undefined) {
          platforms[platform].plus = 0;
        }
        platforms[platform].plus++;
      }
      if (platform === 'appstore' && purchases[key].netflix) {
        if (platforms[platform].netflix === undefined) {
          platforms[platform].netflix = 0;
        }
        platforms[platform].netflix++;
      }
    });
  };

  addPurchases(await purchaseService.getSteamPurchases());
  addPurchases(await purchaseService.getPlaystationPurchases());
  addPurchases(await purchaseService.getEpicPurchases());
  addPurchases(await purchaseService.getAmazonPurchases());
  addPurchases(await purchaseService.getGOGPurchases());
  addPurchases(await purchaseService.getSwitchPurchases());
  addPurchases(await purchaseService.getAppStorePurchases());

  purchasedGames.forEach(game => {
    if (profile.favourite && profile.favourite.find(fav => GameDatabaseService.createGameSlug(fav) === game.key)) {
      game.favourite = true;
    }
    if (profile.played && profile.played.find(played => GameDatabaseService.createGameSlug(played) === game.key)) {
      game.played = true;
    }
    if (profile.playing && profile.playing.find(playing => GameDatabaseService.createGameSlug(playing) === game.key)) {
      game.playing = true;
    }
    if (profile.liked && profile.liked.find(liked => GameDatabaseService.createGameSlug(liked) === game.key)) {
      game.liked = true;
    }
    if (profile.interesting && profile.interesting.find(interesting => GameDatabaseService.createGameSlug(interesting) === game.key)) {
      game.interesting = true;
    }
  });

  await database.save(`${process.env.SOURCE_DIR}${GameDatabaseService.GAME_DATABASE_FILE}`);

  const template = await fs.promises.readFile(`${process.env.SOURCE_DIR}/template.html`, 'utf-8');
  const html = template.toString().replace('{{game-grid}}', renderGameGrid(purchasedGames, platforms));

  await fs.promises.writeFile(path, html);

  const gameTitles: Record<string, string> = {};
  purchasedGames.forEach(game => {
    gameTitles[game.key] = game.title;
  });

  await fs.promises.writeFile(`${process.env.SOURCE_DIR}${GameDatabaseService.GAME_TITLES_FILE}`, JSON.stringify(gameTitles, null, 2));
};

export default generateGamesData;