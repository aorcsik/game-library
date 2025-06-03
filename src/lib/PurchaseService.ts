import fs from 'fs';
import { GameLibraryConfig } from './Config';
import GameDatabaseService, { Game } from './GameDatabaseService';
import { Platform, PlatformLogos, PlatformList } from './types';
import { AppStorePurchaseData, GameCollections, GOGLibraryData, HeroicLibraryData, PlaystationPurchaseData, SteamAPIGetOwnedGamesResponse, SwitchPurchaseData, XboxPurchaseData } from './schema';
import { formatTitle } from './tools';
import { client } from './sanity';
import { MultipleMutationResult } from '@sanity/client';

type Purchase = {
  _type: 'purchase';
  key: string;
  platform: Platform;
  title: string;
  cover: string;
  collection?: string;
  generation?: string[];
  plus?: boolean;
  netflix?: boolean;
  appId?: number;
  physical: boolean;
  logo: PlatformLogos;
};

type SteamPurchase = Purchase & {
  platform: 'steam';
  appId: number;
  physical: false;
};

type EpicPurchase = Purchase & {
  platform: 'epic';
  physical: false;
};

type GOGPurchase = Purchase & {
  platform: 'gog';
  physical: false;
};

type AmazonPurchase = Purchase & {
  platform: 'amazon';
  physical: false;
};

type SwitchPurchase = Purchase & {
  platform: 'switch';
  physical: boolean;
};

type AppStorePurchase = Purchase & {
  platform: 'appstore';
  netflix: boolean;
  physical: false;
};

type PlaystationPurchase = Purchase & {
  platform: 'playstation';
  plus: boolean;
  generation: ('PS4' | 'PS5')[];
  physical: boolean;
};

type XboxPurchase = Purchase & {
  platform: 'xbox';
};

type PlatformPurchase = SteamPurchase |
EpicPurchase |
GOGPurchase |
AmazonPurchase |
SwitchPurchase |
AppStorePurchase |
PlaystationPurchase |
XboxPurchase;

type PurchasedGame = Game & {
  purchases: PlatformPurchase[];
};

const getPurchasesFromSanity = async <T extends PlatformPurchase>(platform: Platform): Promise<Record<string, T>> => {
  const query = `*[_type == "purchase" && platform == "${platform}"]`;
  const purchaseList: Purchase[] = await client.fetch(query);
  const purchases: Record<string, T> = {};
  purchaseList.forEach(purchase => {
    purchases[purchase.key] = purchase as T;
  });
  return purchases;
};

const savePurchasesToSanity = async (platform: Platform, purchases: Record<string, Purchase>): Promise<MultipleMutationResult> => {
  await client.delete({ query: '*[_type == "purchase" && platform == $platform]', params: { platform: platform } });
  const sanityTransaction = client.transaction();
  Object.values(purchases).forEach(purchase => {
    sanityTransaction.create(purchase);
  });
  const result = await sanityTransaction.commit();
  process.stdout.write(`Purchases for ${platform} saved to Sanity.\n`);
  return result;
};

class PurchaseService {
  private config: GameLibraryConfig;
  private database: GameDatabaseService;
  private skipTitle: string[];

  private steamCollections: GameCollections = {
    'The Alto Collection': [
      {'title': "Alto's Adventure"},
      {'title': "Alto's Odyssey"}
    ],
    'FRAMED Collection': [
      {'title': 'FRAMED'},
      {'title': 'FRAMED 2'}
    ],
    // 'Halo: The Master Chief Collection': [
    //   {'title': 'Halo: Combat Evolved Anniversary'},
    //   {'title': 'Halo 2: Anniversary'},
    //   {'title': 'Halo 3'},
    //   {'title': 'Halo 3: ODST'},
    //   {'title': 'Halo: Reach'},
    //   {'title': 'Halo 4'},
    // ]
  };

  constructor(config: GameLibraryConfig, database: GameDatabaseService, skipTitle: string[]) {
    this.config = config;
    this.database = database;
    this.skipTitle = skipTitle;
  }

  async getSteamPurchases(fromSanity: boolean = false): Promise<Record<string, SteamPurchase>> {
    if (fromSanity) {
      return await getPurchasesFromSanity('steam');
    }
    const purchases: Record<string, SteamPurchase> = {};
    if (this.config.steam_api_key && this.config.steam_id) {
      process.stdout.write('Fetching Steam purchases...\n');
      const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${this.config.steam_api_key}&steamid=${this.config.steam_id}&include_appinfo=1&format=json`;
      const steamApiResponse = await fetch(url);
      const steamApiResponseText = await steamApiResponse.text();
      let steamApiData: SteamAPIGetOwnedGamesResponse;
      try {
        steamApiData = JSON.parse(steamApiResponseText) as SteamAPIGetOwnedGamesResponse;
      } catch (error) {
        process.stdout.write(`Error parsing Steam API response: ${(error as Error)}\n`);
        process.stdout.write(`Response: ${steamApiResponseText}\n`);
        return purchases;
      }
      process.stdout.write(`Steam purchases fetched: ${steamApiData.response.game_count}\n`);
      steamApiData.response.games.forEach(element => {
        if (this.skipTitle.includes(element.name)) return;
    
        const title = formatTitle(element.name);
        if (this.steamCollections[element.name]) {
          this.steamCollections[element.name].forEach(collectionItem => {
            const collectionTitle = formatTitle(collectionItem.title);
            const game = this.database.getGameByTitle(collectionTitle);
            this.database.updateGame(game, { steamAppId: element.appid });
            if (!purchases[game.key]) purchases[game.key] = {
              _type: 'purchase',
              key: game.key,
              platform: 'steam',
              appId: element.appid,
              title: collectionTitle,
              collection: title,
              cover: `https://steamcdn-a.akamaihd.net/steam/apps/${element.appid}/header.jpg`,
              physical: false,
              logo: 'steam',
            };
          });
        } else {
          const game = this.database.getGameByTitle(title);
          this.database.updateGame(game, { steamAppId: element.appid });
          if (!purchases[game.key]) purchases[game.key] = {
            _type: 'purchase',
            key: game.key,
            platform: 'steam',
            appId: element.appid,
            title: title,
            cover: `https://steamcdn-a.akamaihd.net/steam/apps/${element.appid}/header.jpg`,
            physical: false,
            logo: 'steam',
          };
        }
      });
    }

    await savePurchasesToSanity('steam', purchases);

    return purchases;
  }

  async getEpicPurchases(fromSanity: boolean = false): Promise<Record<string, EpicPurchase>> {
    if (fromSanity) {
      return await getPurchasesFromSanity('epic');
    }
    const purchases: Record<string, EpicPurchase> = {};
    if (this.config.epic_library) {
      const epicLibraryFile = await fs.promises.readFile(this.config.epic_library, 'utf-8');
      const epicLibraryData = await JSON.parse(epicLibraryFile.toString()) as HeroicLibraryData;
      epicLibraryData.library.forEach(element => {
        if (this.skipTitle.includes(element.title)) return;
        if (element.install.is_dlc) return;

        const title = formatTitle(element.title);
        const game = this.database.getGameByTitle(title);
        if (!purchases[game.key]) purchases[game.key] = {
          _type: 'purchase',
          key: game.key,
          platform: 'epic',
          title: title,
          cover: element.art_cover,
          physical: false,
          logo: 'epic',
        };
      });
    }

    await savePurchasesToSanity('epic', purchases);

    return purchases;
  }

  async getAmazonPurchases(fromSanity: boolean = false): Promise<Record<string, AmazonPurchase>> {
    if (fromSanity) {
      return await getPurchasesFromSanity('amazon');
    }
    const purchases: Record<string, AmazonPurchase> = {};
    if (this.config.amazon_library) {
      const amazonLibraryFile = await fs.promises.readFile(this.config.amazon_library, 'utf-8');
      const amazonLibraryData = await JSON.parse(amazonLibraryFile.toString()) as HeroicLibraryData;
      amazonLibraryData.library.forEach(element => {
        if (this.skipTitle.includes(element.title)) return;
        if (element.install.is_dlc) return;

        const title = formatTitle(element.title);
        const game = this.database.getGameByTitle(title);
        if (!purchases[game.key]) purchases[game.key] = {
          _type: 'purchase',
          key: game.key,
          platform: 'amazon',
          title: title,
          cover: element.art_cover,
          physical: false,
          logo: 'amazon',
        };
      });
    }

    await savePurchasesToSanity('amazon', purchases);

    return purchases;
  }

  async getGOGPurchases(fromSanity: boolean = false): Promise<Record<string, GOGPurchase>> {
    if (fromSanity) {
      return await getPurchasesFromSanity('gog');
    }
    const purchases: Record<string, GOGPurchase> = {};
    if (this.config.gog_library) {
      const gogLibraryFile = await fs.promises.readFile(this.config.gog_library, 'utf-8');
      const gogLibraryData = await JSON.parse(gogLibraryFile.toString()) as GOGLibraryData;
      gogLibraryData.games.forEach(element => {
        if (this.skipTitle.includes(element.title)) return;
        if (element.install.is_dlc) return;

        const title = formatTitle(element.title);
        const game = this.database.getGameByTitle(title);
        if (!purchases[game.key]) purchases[game.key] = {
          _type: 'purchase',
          key: game.key,
          platform: 'gog',
          title: title,
          cover: element.art_cover,
          physical: false,
          logo: 'gog',
        };
      });
    }

    await savePurchasesToSanity('gog', purchases);

    return purchases;
  }

  async getSwitchPurchases(fromSanity: boolean = false): Promise<Record<string, SwitchPurchase>> {
    if (fromSanity) {
      return await getPurchasesFromSanity('switch');
    }
    const purchases: Record<string, SwitchPurchase> = {};
    if (this.config.switch_library) {
      const nintendoPurchaseFile = await fs.promises.readFile(this.config.switch_library, 'utf-8');
      const nintendoPurchaseData = JSON.parse(nintendoPurchaseFile.toString()) as SwitchPurchaseData;
      Object.keys(nintendoPurchaseData.purchases).forEach(purchase => {
        nintendoPurchaseData.purchases[purchase].forEach(element => {
          if (this.skipTitle.includes(element.title)) return;

          const title = formatTitle(element.title);
          if (nintendoPurchaseData.collections[element.title]) {
            nintendoPurchaseData.collections[element.title].forEach(collectionItem => {
              const collectionTitle = formatTitle(collectionItem.title);
              const game = this.database.getGameByTitle(collectionTitle);
              if (!purchases[game.key]) purchases[game.key] = {
                _type: 'purchase',
                key: game.key,
                platform: 'switch',
                title: collectionTitle,
                cover: element.cover,
                collection: title,
                physical: false,
                logo: 'switch',
              };
              purchases[game.key].physical = purchases[game.key].physical || !!element.physical;
            });
          } else {
            const game = this.database.getGameByTitle(title);
            if (!purchases[game.key]) purchases[game.key] = {
              _type: 'purchase',
              key: game.key,
              platform: 'switch',
              title: title,
              cover: element.cover,
              physical: !!element.physical,
              logo: 'switch',
            };
            purchases[game.key].physical = purchases[game.key].physical || !!element.physical;
          }
        });
      });
    }

    await savePurchasesToSanity('switch', purchases);

    return purchases;
  }

  async getAppStorePurchases(fromSanity: boolean = false): Promise<Record<string, AppStorePurchase>> {
    if (fromSanity) {
      return await getPurchasesFromSanity('appstore');
    }
    const purchases: Record<string, AppStorePurchase> = {};
    if (this.config.appstore_library) {
      const appStorePurchaseFile = await fs.promises.readFile(this.config.appstore_library, 'utf-8');
      const appStorePurchaseData = JSON.parse(appStorePurchaseFile.toString()) as AppStorePurchaseData;
      Object.keys(appStorePurchaseData).forEach(purchase => {
        appStorePurchaseData[purchase].forEach(element => {
          if (this.skipTitle.includes(element.title)) return;

          const title = formatTitle(element.title);
          const game = this.database.getGameByTitle(title);
          if (!purchases[game.key]) purchases[game.key] = {
            _type: 'purchase',
            key: game.key,
            platform: 'appstore',
            title: title,
            cover: element.cover,
            netflix: true,  // will be overwritten
            physical: false,
            logo: 'appstore',
          };
          purchases[game.key].netflix = purchases[game.key].netflix === false ? false : !!element.netflix;
          if (purchases[game.key].netflix) purchases[game.key].logo = 'netflix';
        });
      });
    }

    await savePurchasesToSanity('appstore', purchases);

    return purchases;
  }

  async getXboxPurchases(fromSanity: boolean = false): Promise<Record<string, XboxPurchase>> {
    if (fromSanity) {
      return await getPurchasesFromSanity('xbox');
    }
    const purchases: Record<string, XboxPurchase> = {};
    if (this.config.xbox_library) {
      const xboxPurchaseFile = await fs.promises.readFile(this.config.xbox_library, 'utf-8');
      const xboxPurchaseData = JSON.parse(xboxPurchaseFile.toString()) as XboxPurchaseData;
      Object.keys(xboxPurchaseData).forEach(purchase => {
        xboxPurchaseData[purchase].forEach(element => {
          if (this.skipTitle.includes(element.title)) return;

          const title = formatTitle(element.title);
          const game = this.database.getGameByTitle(title);
          if (!purchases[game.key]) purchases[game.key] = {
            _type: 'purchase',
            key: game.key,
            platform: 'xbox',
            title: title,
            cover: element.cover,
            physical: false,
            logo: 'xbox',
          };
          purchases[game.key].physical = purchases[game.key].physical || !!element.physical;
        });
      });
    }

    await savePurchasesToSanity('xbox', purchases);

    return purchases;
  }

  async getPlaystationPurchases(fromSanity: boolean = false): Promise<Record<string, PlaystationPurchase>> {
    if (fromSanity) {
      return await getPurchasesFromSanity('playstation');
    }
    const purchases: Record<string, PlaystationPurchase> = {};
    if (this.config.playstation_library) {
      const playstationPurchaseFile = await fs.promises.readFile(this.config.playstation_library, 'utf-8');
      const playstationPurchaseData = JSON.parse(playstationPurchaseFile.toString()) as PlaystationPurchaseData;
      playstationPurchaseData.purchases.forEach(page => {
        page.forEach(purchase => {
          if (this.skipTitle.includes(purchase.titleName)) return;
    
          const title = formatTitle(purchase.titleName);
          if (playstationPurchaseData.collections[purchase.titleName]) {
            playstationPurchaseData.collections[purchase.titleName].forEach(collectionItem => {
              const collectionTitle = formatTitle(collectionItem.title);
              const game = this.database.getGameByTitle(collectionTitle);
              if (!purchases[game.key]) purchases[game.key] = {
                _type: 'purchase',
                key: game.key,
                platform: 'playstation',
                title: collectionTitle,
                cover: purchase.cover,
                collection: title,
                physical: !!purchase.physical,
                plus: true,  // will be overwritten
                generation: [],
                logo: 'playstation',
              };
              purchases[game.key].plus = purchases[game.key].plus === false ? false : purchase.serviceUpsell === 'PS PLUS';
              if (purchases[game.key].plus) purchases[game.key].logo = 'psplus';
              purchases[game.key].generation.push(purchase.platform);
              purchases[game.key].physical = purchases[game.key].physical || !!purchase.physical;
            });
          } else {
            const game = this.database.getGameByTitle(title);
            if (!purchases[game.key]) purchases[game.key] = {
              _type: 'purchase',
              key: game.key,
              platform: 'playstation',
              title: title,
              cover: purchase.cover,
              physical: !!purchase.physical,
              plus: true,  // will be overwritten
              generation: [],
              logo: 'playstation',
            };
            purchases[game.key].plus = purchases[game.key].plus === false ? false : purchase.serviceUpsell === 'PS PLUS';
            purchases[game.key].generation.push(purchase.platform);
            purchases[game.key].physical = purchases[game.key].physical || !!purchase.physical;
            if (purchases[game.key].plus) purchases[game.key].logo = 'psplus';
          }
        });
      });
    }

    await savePurchasesToSanity('playstation', purchases);

    return purchases;
  }
}

export default PurchaseService;
export type { Platform, PlatformList, PlatformPurchase, PurchasedGame };