export type GameLibraryConfig = {
  source_dir?: string;
  steam_api_key?: string;
  steam_id?: string;
  steam_profile_name?: string;
  steam_account_name?: string;
  epic_library?: string;
  amazon_library?: string;
  gog_library?: string;
  switch_library: string;
  appstore_library: string;
  playstation_library: string;
  playstation_online_id?: string;
  xbox_library?: string;
  xbox_gamertag?: string;
  transactions: string;
};

export const getGameLibraryConfig = (): GameLibraryConfig => {
  return {
    source_dir: process.env.SOURCE_DIR,
    steam_api_key: process.env.STEAM_API_KEY,
    steam_id: process.env.STEAM_ID,
    steam_profile_name: process.env.STEAM_PROFILE_NAME,
    steam_account_name: process.env.STEAM_ACCOUNT_NAME,
    epic_library: process.env.HEROIC_CACHE_DIR && `${process.env.HEROIC_CACHE_DIR}/legendary_library.json`,
    amazon_library: process.env.HEROIC_CACHE_DIR && `${process.env.HEROIC_CACHE_DIR}/nile_library.json`,
    gog_library: process.env.HEROIC_CACHE_DIR && `${process.env.HEROIC_CACHE_DIR}/gog_library.json`,
    switch_library: `${process.env.SOURCE_DIR}/data/purchases/switch.json`,
    appstore_library: `${process.env.SOURCE_DIR}/data/purchases/appstore.json`,
    playstation_library: `${process.env.SOURCE_DIR}/data/purchases/playstation.json`,
    playstation_online_id: process.env.PLAYSTATION_ONLINE_ID,
    xbox_library: `${process.env.SOURCE_DIR}/data/purchases/xbox.json`,
    xbox_gamertag: process.env.XBOX_GAMERTAG,
    transactions: `${process.env.SOURCE_DIR}/data/purchases/transactions/`,
  };
};