import fs from 'fs';
import { Game } from './schema';

class GameDatabaseService {

  static readonly GAME_DATABASE_FILE = '/data/games.json';

  static readonly GAME_TITLES_FILE = '/data/game-titles.json';

  static async initDatabase(path: string): Promise<GameDatabaseService> {
    const gamesFile = await fs.promises.readFile(path, 'utf-8');
    return new GameDatabaseService(JSON.parse(gamesFile.toString()) as Game[]);
  }

  static createGameSlug = (title: string): string => {
    return title
      .replace(/[-–]/g, ' ')
      .replace(/['’]/g, '\'')
      .replace(/²/g, '2')
      .replace(/³/g, '3')
      .replace(/[^A-Za-z0-9 ]/g, '')
      .replace(/\s+/g, ' ').trim()
      .replace(/ /g, '-')
      .toLowerCase()
      .replace(/^(a|an|the) (.*)$/, '$2, $1');
  };

  static formatTitle(title: string): string {
    return title
      .replace(/[™Ⓡ®]/g, '')
      .replace(/['’]/g, '\'')
      .replace(/[-–]/g, '-')
      .replace(/\s+/g, ' ').trim();
  };

  private database: Game[];

  constructor(database: Game[]) {
    this.database = database;
  }

  findIndex(callback: (gameConfig: Game) => boolean | undefined): number {
    for (let i = 0; i < this.database.length; i++) {
      if (callback(this.database[i])) {
        return i;
      }
    }
    return -1;
  }

  findIndexByTitle(title: string): number {
    const c = (title: string): string => {
      return title.toLocaleLowerCase().replace(/[-:!™Ⓡ®–'’]/g, '').replace(/\s+/g, ' ').trim();
    };
    return this.findIndex(
      game => 
        c(game.title) === c(title) || 
        game.key === GameDatabaseService.createGameSlug(title) ||
        (game.sameGame && game.sameGame.filter(sameGame => c(sameGame) === c(title)).length > 0));
  };

  getGameByTitle(title: string): Game {
    let index = this.findIndexByTitle(title);
    if (index === -1) {
      process.stdout.write(`Game with title "${title}" not found in database. Adding new entry.\n`);
      this.database.push({
        title: title,
        key: GameDatabaseService.createGameSlug(title),
      });
      index = this.database.length - 1;
    } else {
      this.database[index].key = GameDatabaseService.createGameSlug(this.database[index].title);
    }
    return this.database[index];
  };

  updateGame(game: Game, gameUpdates: Partial<Game>): Game {
    const index = this.findIndex(g => g.key === game.key);
    if (index !== -1) {
      this.database[index] = {
        ...this.database[index],
        ...gameUpdates
      };
      return this.database[index];
    }
    throw new Error(`Game with key ${game.key} not found in database.`);
  };

  async save(path: string): Promise<void> {
    return await fs.promises.writeFile(path, JSON.stringify(this.database, null, 2));
  }
}

export default GameDatabaseService;
export type { Game };