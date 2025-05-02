import GameLibrary from '../components/GameLibrary';
import GameDatabaseService from '../lib/GameDatabaseService';
import { getGameLibraryData } from '../lib/GameLibrary';
import { PlatformList, PurchasedGame } from '../lib/PurchaseService';


export default async function Home(): Promise<React.JSX.Element> {
  const databaseFilePath = `${process.env.SOURCE_DIR || '.'}${GameDatabaseService.GAME_DATABASE_FILE}`;
  const database = await GameDatabaseService.initDatabase(databaseFilePath);
  const [purchasedGames, platforms]: [PurchasedGame[], PlatformList] = await getGameLibraryData(database, true);

  return <GameLibrary purchasedGames={purchasedGames} platforms={platforms} />;
}
