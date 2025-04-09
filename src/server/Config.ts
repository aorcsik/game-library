export type GameLibraryConfig = {
  steam_api_key?: string;
  steam_id?: string;
  epic_library?: string;
  amazon_library?: string;
  gog_library?: string;
  switch_library: string;
  appstore_library: string;
  playstation_library: string;
};

export const getGameLibraryConfig = (): GameLibraryConfig => {
  return {
    steam_api_key: process.env.STEAM_API_KEY,
    steam_id: process.env.STEAM_ID,
    epic_library: process.env.HEROIC_CACHE_DIR && `${process.env.HEROIC_CACHE_DIR}/legendary_library.json`,
    amazon_library: process.env.HEROIC_CACHE_DIR && `${process.env.HEROIC_CACHE_DIR}/nile_library.json`,
    gog_library: process.env.HEROIC_CACHE_DIR && `${process.env.HEROIC_CACHE_DIR}/gog_library.json`,
    switch_library: `${process.env.SOURCE_DIR}/data/purchases/switch.json`,
    appstore_library: `${process.env.SOURCE_DIR}/data/purchases/appstore.json`,
    playstation_library: `${process.env.SOURCE_DIR}/data/purchases/playstation.json`,
  };
};