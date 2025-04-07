import fs from 'fs';

export type GameLibraryConfig = {
  steam_api_key: string;
  steam_id: string;
  epic_library: string;
  amazon_library: string;
  gog_library: string;
  nintendo_library: string;
  appstore_library: string;
  playstation_library: string;
};

export const getGameLibraryConfig = async (path: string): Promise<GameLibraryConfig> => {
  const configFile = await fs.promises.readFile(path, 'utf-8');
  return JSON.parse(configFile.toString()) as GameLibraryConfig;
};