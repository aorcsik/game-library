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

type GameCollections = Record<string, { title: string }[]>;

type SteamData = {
  title: string | null;
  description: string | null;
  genres: string[];
  releaseDate: string | null;
  reviewScore: number | null;
  reviewScoreDescription: string | null;
  metacriticUrl?: string | null;
  headerImage: string | null;
  updated: string;
};

type MetacriticData = {
  title: string | null;
  releaseDate: string | null;
  metacriticScore: number | null;
  updated: string;
};

type OpenCriricData = {
  title: string | null;
  cover: string | null;
  tier: string | null;
  score: number | null;
  critics: number | null;
  releaseDate: string | null;
  updated: string;
};

type Game = {
  title: string;
  key: string;
  sameGame?: string[];
  openCriticId?: string;
  openCriticData?: OpenCriricData;
  steamAppId?: number;
  steamData?: SteamData;
  metacriticUrl?: string;
  metacriticData?: MetacriticData;
  releaseDate?: string;
};

export type {
  SteamAPIGetOwnedGamesResponse,
  HeroicGameData,
  HeroicLibraryData,
  GOGLibraryData,
  SwitchPurchaseData,
  AppStorePurchaseData,
  PlaystationPurchaseData,
  GameCollections,
  SteamData,
  MetacriticData,
  OpenCriricData,
  Game,
};