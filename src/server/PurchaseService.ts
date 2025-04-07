import fs from 'fs';
import { GameLibraryConfig } from './Config';
import GameDatabaseService, { Game } from './GameDatabaseService';

type Platform = 'steam' | 'epic' | 'gog' | 'amazon' | 'playstation' | 'appstore' | 'switch';
type PlatformLogo = Platform | 'psplus' | 'netflix';

type PlatformList = Record<Platform, {
  name: string;
  count: number;
  plus?: number;
}>;

type Purchase = {
  platform: Platform;
  title: string;
  cover: string;
  collection?: string;
  physical: boolean;
  logo: PlatformLogo;
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

type GameCollections = Record<string, { title: string }[]>;

type SteamAPIGetOwnedGamesResponse = {
  response: {
    game_count: number;
    games: {
      appid: number;
      name: string;
      playtime_forever: number;
      img_icon_url: string;
    }[];
  };
};

type HeroicGameData = {
  title: string;
  install: {
    is_dlc: boolean;
  };
  art_cover: string;
};

type HeroicLibraryData = {
  library: HeroicGameData[];
};

type GOGLibraryData = {
  games: HeroicGameData[];
};

type SwitchPurchaseData = {
  purchases: Record<string,
    {
      title: string;
      cover: string;
      physical: boolean;
    }[]>;
  collections: GameCollections;
};

type AppStorePurchaseData = Record<string,
  {
    title: string;
    cover: string;
    netflix: boolean;
  }[]>;

type PlaystationPurchaseData = {
  purchases: {
      titleName: string;
      cover: string;
      physical: boolean;
      serviceUpsell: string;
      platform: 'PS4' | 'PS5';
    }[][];
  collections: GameCollections;
};

type PlatformPurchse = SteamPurchase |
EpicPurchase |
GOGPurchase |
AmazonPurchase |
SwitchPurchase |
AppStorePurchase |
PlaystationPurchase;

type PurchasedGame = Game & {
  purchases: PlatformPurchse[];
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
    ]
  };

  constructor(config: GameLibraryConfig, database: GameDatabaseService, skipTitle: string[]) {
    this.config = config;
    this.database = database;
    this.skipTitle = skipTitle;
  }

  async getSteamPurchases(): Promise<Record<string, SteamPurchase>> {
    const purchases: Record<string, SteamPurchase> = {};
    if (this.config.steam_api_key && this.config.steam_id) {
      const steamApiResponse = await fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${this.config.steam_api_key}&steamid=${this.config.steam_id}&include_appinfo=1&format=json`);
      const steamApiData = await steamApiResponse.json() as SteamAPIGetOwnedGamesResponse;
      steamApiData.response.games.forEach(element => {
        if (this.skipTitle.includes(element.name)) return;
    
        const title = GameDatabaseService.formatTitle(element.name);
        if (this.steamCollections[element.name]) {
          this.steamCollections[element.name].forEach(collectionItem => {
            const collectionTitle = GameDatabaseService.formatTitle(collectionItem.title);
            const game = this.database.getGameByTitle(collectionTitle);
            this.database.updateGame(game, { steamAppId: element.appid });
            if (!purchases[game.key]) purchases[game.key] = {
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
    return purchases;
  }

  async getEpicPurchases(): Promise<Record<string, EpicPurchase>> {
    const purchases: Record<string, EpicPurchase> = {};
    if (this.config.epic_library) {
      const epicLibraryFile = await fs.promises.readFile(this.config.epic_library, 'utf-8');
      const epicLibraryData = await JSON.parse(epicLibraryFile.toString()) as HeroicLibraryData;
      epicLibraryData.library.forEach(element => {
        if (this.skipTitle.includes(element.title)) return;
        if (element.install.is_dlc) return;

        const title = GameDatabaseService.formatTitle(element.title);
        const game = this.database.getGameByTitle(title);
        if (!purchases[game.key]) purchases[game.key] = {
          platform: 'epic',
          title: title,
          cover: element.art_cover,
          physical: false,
          logo: 'epic',
        };
      });
    }
    return purchases;
  }

  async getAmazonPurchases(): Promise<Record<string, AmazonPurchase>> {
    const purchases: Record<string, AmazonPurchase> = {};
    if (this.config.amazon_library) {
      const amazonLibraryFile = await fs.promises.readFile(this.config.amazon_library, 'utf-8');
      const amazonLibraryData = await JSON.parse(amazonLibraryFile.toString()) as HeroicLibraryData;
      amazonLibraryData.library.forEach(element => {
        if (this.skipTitle.includes(element.title)) return;
        if (element.install.is_dlc) return;

        const title = GameDatabaseService.formatTitle(element.title);
        const game = this.database.getGameByTitle(title);
        if (!purchases[game.key]) purchases[game.key] = {
          platform: 'amazon',
          title: title,
          cover: element.art_cover,
          physical: false,
          logo: 'amazon',
        };
      });
    }
    return purchases;
  }

  async getGOGPurchases(): Promise<Record<string, GOGPurchase>> {
    const purchases: Record<string, GOGPurchase> = {};
    if (this.config.gog_library) {
      const gogLibraryFile = await fs.promises.readFile(this.config.gog_library, 'utf-8');
      const gogLibraryData = await JSON.parse(gogLibraryFile.toString()) as GOGLibraryData;
      gogLibraryData.games.forEach(element => {
        if (this.skipTitle.includes(element.title)) return;
        if (element.install.is_dlc) return;

        const title = GameDatabaseService.formatTitle(element.title);
        const game = this.database.getGameByTitle(title);
        if (!purchases[game.key]) purchases[game.key] = {
          platform: 'gog',
          title: title,
          cover: element.art_cover,
          physical: false,
          logo: 'gog',
        };
      });
    }
    return purchases;
  }

  async getSwitchPurchases(): Promise<Record<string, SwitchPurchase>> {
    const purchases: Record<string, SwitchPurchase> = {};
    if (this.config.nintendo_library) {
      const nintendoPurchaseFile = await fs.promises.readFile(this.config.nintendo_library, 'utf-8');
      const nintendoPurchaseData = JSON.parse(nintendoPurchaseFile.toString()) as SwitchPurchaseData;
      Object.keys(nintendoPurchaseData.purchases).forEach(purchase => {
        nintendoPurchaseData.purchases[purchase].forEach(element => {
          if (this.skipTitle.includes(element.title)) return;

          const title = GameDatabaseService.formatTitle(element.title);
          if (nintendoPurchaseData.collections[element.title]) {
            nintendoPurchaseData.collections[element.title].forEach(collectionItem => {
              const collectionTitle = GameDatabaseService.formatTitle(collectionItem.title);
              const game = this.database.getGameByTitle(collectionTitle);
              if (!purchases[game.key]) purchases[game.key] = {
                platform: 'switch',
                title: collectionTitle,
                cover: element.cover,
                collection: title,
                physical: !!element.physical,
                logo: 'switch',
              };
              purchases[game.key].physical = purchases[game.key].physical || !!element.physical;
            });
          } else {
            const game = this.database.getGameByTitle(title);
            if (!purchases[game.key]) purchases[game.key] = {
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
    return purchases;
  }

  async getAppStorePurchases(): Promise<Record<string, AppStorePurchase>> {
    const purchases: Record<string, AppStorePurchase> = {};
    if (this.config.appstore_library) {
      const appStorePurchaseFile = await fs.promises.readFile(this.config.appstore_library, 'utf-8');
      const appStorePurchaseData = JSON.parse(appStorePurchaseFile.toString()) as AppStorePurchaseData;
      Object.keys(appStorePurchaseData).forEach(purchase => {
        appStorePurchaseData[purchase].forEach(element => {
          if (this.skipTitle.includes(element.title)) return;

          const title = GameDatabaseService.formatTitle(element.title);
          const game = this.database.getGameByTitle(title);
          if (!purchases[game.key]) purchases[game.key] = {
            platform: 'appstore',
            title: title,
            cover: element.cover,
            netflix: false,
            physical: false,
            logo: 'appstore',
          };
          purchases[game.key].netflix = purchases[game.key].netflix === false ? false : !!element.netflix;
          if (purchases[game.key].netflix) purchases[game.key].logo = 'netflix';
        });
      });
    }
    return purchases;
  }

  async getPlaystationPurchases(): Promise<Record<string, PlaystationPurchase>> {
    const purchases: Record<string, PlaystationPurchase> = {};
    if (this.config.playstation_library) {
      const playstationPurchaseFile = await fs.promises.readFile(this.config.playstation_library, 'utf-8');
      const playstationPurchaseData = JSON.parse(playstationPurchaseFile.toString()) as PlaystationPurchaseData;
      playstationPurchaseData.purchases.forEach(page => {
        page.forEach(purchase => {
          if (this.skipTitle.includes(purchase.titleName)) return;
    
          const title = GameDatabaseService.formatTitle(purchase.titleName);
          if (playstationPurchaseData.collections[purchase.titleName]) {
            playstationPurchaseData.collections[purchase.titleName].forEach(collectionItem => {
              const collectionTitle = GameDatabaseService.formatTitle(collectionItem.title);
              const game = this.database.getGameByTitle(collectionTitle);
              if (!purchases[game.key]) purchases[game.key] = { 
                platform: 'playstation',
                title: collectionTitle,
                cover: purchase.cover,
                collection: title,
                physical: !!purchase.physical,
                plus: false,
                generation: [],
                logo: 'playstation',
              };
              purchases[game.key].plus = purchases[game.key].plus === false ? false : purchase.serviceUpsell === 'PS PLUS';
              purchases[game.key].generation.push(purchase.platform);
              purchases[game.key].physical = purchases[game.key].physical || !!purchase.physical;
              if (purchases[game.key].plus) purchases[game.key].logo = 'psplus';
            });
          } else {
            const game = this.database.getGameByTitle(title);
            if (!purchases[game.key]) purchases[game.key] = {
              platform: 'playstation',
              title: title,
              cover: purchase.cover,
              physical: !!purchase.physical,
              plus: false,
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
    return purchases;
  }
}

export default PurchaseService;
export type { Platform, PlatformList, PlatformPurchse, PurchasedGame };