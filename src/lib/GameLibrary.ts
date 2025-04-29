import { getGameLibraryConfig } from './Config';
import GameDatabaseService from './GameDatabaseService';
import PurchaseService, { PlatformList, PlatformPurchase, PurchasedGame } from './PurchaseService';

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

export const getGameLibraryData = async (database: GameDatabaseService, fromSanity: boolean): Promise<[PurchasedGame[], PlatformList]> => {
  const config = getGameLibraryConfig();
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

  const addPurchases = <T extends Record<string, PlatformPurchase>>(purchases: T): void => {
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

  addPurchases(await purchaseService.getSteamPurchases(fromSanity));
  addPurchases(await purchaseService.getPlaystationPurchases(fromSanity));
  addPurchases(await purchaseService.getEpicPurchases(fromSanity));
  addPurchases(await purchaseService.getAmazonPurchases(fromSanity));
  addPurchases(await purchaseService.getGOGPurchases(fromSanity));
  addPurchases(await purchaseService.getSwitchPurchases(fromSanity));
  addPurchases(await purchaseService.getAppStorePurchases(fromSanity));

  return [purchasedGames, platforms];
};
