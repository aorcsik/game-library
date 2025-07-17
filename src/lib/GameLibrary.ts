import { PlatformProgress } from '../cli/ProgressFetcherService';
import { getGameLibraryConfig } from './Config';
import GameDatabaseService from './GameDatabaseService';
import NotesService, { SanityGameNotes } from './NotesService';
import ProgressService from './ProgressService';
import PurchaseService, { PlatformList, PlatformPurchase, PurchasedGame, SinglePurchase } from './PurchaseService';

const skipTitle = [
// Playstation
  'HBO GO',
  'Spotify',
  'Netflix',
  'YouTube',
  'EA Play Hub',
  'Prime Video',
  'Media Player',
  'Twitch',
  'The Matrix Awakens: An Unreal Engine 5 Experience',
  'Detroit: Become Human™ Digital Deluxe Soundtrack',
  'Shadow of the Tomb Raider - Original Soundtrack',
  'Little Nightmares II - Original Soundtrack',
  "DEATH STRANDING DIRECTOR'S CUT Bonus Content",
  'The Art of Detroit: Become Human™',
  'WipEout™ digital art book',
  'The Art of Horizon Zero Dawn™',
  'The Art of God of War™',
  'The Art of Little Nightmares II',
  'Horizon Zero Dawn™ Artbook',
  'God of War™ Digital Comic: Issue #0',
// Steam
  'Aseprite',
  'Mass Effect 2 (2010)',
  'Indie Game: The Movie',
  'Vessel Demo',
  'The Whispered World',
  'Serious Sam Fusion 2017 (beta)',
  'Tilt Brush',
// Epic
  'Mortal Shell Tech Beta',
  'KillingFloor2Beta',
  'Behind the Frame: The Finest Scenery VR'
];

export const getGameLibraryData = async (
  database: GameDatabaseService,
  fromSanity: { 
    purchases: boolean; 
    progress: boolean;
    notes: boolean;
    purchaseDates: boolean;
  } = {
    purchases: true,
    progress: true,
    notes: true,
    purchaseDates: true
  }
): Promise<[PurchasedGame[], PlatformList]> => {
  const config = getGameLibraryConfig();
  const notesService = new NotesService(config);
  const progressService = new ProgressService(config);
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
    xbox: { name: 'Xbox', count: 0 },
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
          progress: -1,
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

  addPurchases(await purchaseService.getSteamPurchases(fromSanity.purchases));
  addPurchases(await purchaseService.getPlaystationPurchases(fromSanity.purchases));
  addPurchases(await purchaseService.getEpicPurchases(fromSanity.purchases));
  addPurchases(await purchaseService.getAmazonPurchases(fromSanity.purchases));
  addPurchases(await purchaseService.getGOGPurchases(fromSanity.purchases));
  addPurchases(await purchaseService.getSwitchPurchases(fromSanity.purchases));
  addPurchases(await purchaseService.getAppStorePurchases(fromSanity.purchases));
  addPurchases(await purchaseService.getXboxPurchases(fromSanity.purchases));

  const addPurchaseDates = (purchaseDates: SinglePurchase[] | null): void => {
    if (purchaseDates) {
      purchaseDates.forEach(purchase => {
        const game = database.getGameByTitle(purchase.title);
        const purchasedGame = purchasedGames.find(p => p.key === game.key);
        purchasedGame?.purchases.forEach(p => {
          if (p.purchaseDate === undefined || p.purchaseDate > purchase.purchaseDate) {
            p.purchaseDate = purchase.purchaseDate;
          }
        });
      });
    }
  };

  addPurchaseDates(await purchaseService.getPurchaseDates(fromSanity.purchaseDates));

  const addProgress = <T extends PlatformProgress>(platformProgress: T[] | null): void => {
    if (platformProgress) platformProgress.forEach(progress => {
      let progressTitle = progress.title.replace(/(\(EU\)|\(PS4\)|\(PS5\))/g, '').trim();
      if (progressTitle !== 'God of War (PS3)') {
        progressTitle = progressTitle.replace(/(\(PS3\))/, '').trim();
      }

      const game = database.getGameByTitle(progressTitle);
      const purchasedGame = purchasedGames.find(p => p.key === game.key);
      if (purchasedGame) {
        if (purchasedGame.progress === undefined || purchasedGame.progress < progress.progress) {
          purchasedGame.progress = progress.progress;
        }
      } else {
        purchasedGames.push({
          ...game,
          purchases: [],
          progress: progress.progress,
        });
      }
    });
  };

  addProgress(await progressService.getSteamProgress(fromSanity.progress));
  addProgress(await progressService.getPlaystationProgress(fromSanity.progress));
  addProgress(await progressService.getXboxProgress(fromSanity.progress));

  const addNotes = (gameNotes: SanityGameNotes[] | null): void => {
    if (gameNotes) for (const notes of gameNotes) {
      const game = database.getGameByTitle(notes.title);
      if (!purchasedGames.find(p => p.key === game.key)) {
        purchasedGames.push({
          ...game,
          purchases: [],
          progress: -1,
        });
      }
      const purchasedGame = purchasedGames.find(p => p.key === game.key);
      if (purchasedGame) {
        if (notes.progress !== undefined) {
          if (purchasedGame.progress === undefined || purchasedGame.progress < notes.progress) {
            purchasedGame.progress = notes.progress;
          }
        }
        if (notes.completed !== undefined) {
          purchasedGame.completed = notes.completed;
        }
        if (notes.rating !== undefined) {
          purchasedGame.rating = notes.rating;
        }
        if (notes.soundtrack !== undefined) {
          purchasedGame.soundtrack = notes.soundtrack;
        }
        if (notes.watched !== undefined) {
          purchasedGame.watched = notes.watched;
        }
      }
    }
  };

  addNotes(await notesService.getGameNotes(fromSanity.notes));

  return [purchasedGames, platforms];
};
