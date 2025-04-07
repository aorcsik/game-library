import fs from 'fs';

type GameDatabaseRecordInJson = {
  title: string;
  key?: string;
  sameGame?: string[];
  openCriticId?: string;
  openCriticData?: {
    title: string | null;
    cover: string | null;
    tier: string | null;
    score: number | null;
    critics: number | null;
    releaseDate: string | null;
    updated: string;
  };
  steamAppId?: number;
  steamData?: {
    title: string;
    description: string | null;
    genres: string[];
    releaseDate: string | null;
    reviewScore: number | null;
    reviewScoreDescription: string | null;
    metacriticUrl: string | null;
    headerImage: string;
    updated: string;
  };
  metacriticUrl?: string;
  metacriticData?: {
    title: string;
    releaseDate: string | null;
    metacriticScore: number | null;
    updated: string;
  };
  releaseDate?: string;
};

type Game = GameDatabaseRecordInJson & {
  key: string;
};

class GameDatabaseService {

  static async initDatabase(path: string): Promise<GameDatabaseService> {
    const gamesFile = await fs.promises.readFile(path, 'utf-8');
    return new GameDatabaseService(JSON.parse(gamesFile.toString()) as GameDatabaseRecordInJson[]);
  }

  static createGameSlug = (title: string): string => {
    return title.replace(/^(A|An|The) (.*)$/, '$2, $1').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  };

  static formatTitle(title: string): string {
    title = title.replace('Ⓡ', '®');
    return title;
  };

  private database: GameDatabaseRecordInJson[];

  constructor(database: GameDatabaseRecordInJson[]) {
    this.database = database;
  }

  findIndex(callback: (gameConfig: GameDatabaseRecordInJson) => boolean | undefined): number {
    for (let i = 0; i < this.database.length; i++) {
      if (callback(this.database[i])) {
        return i;
      }
    }
    return -1;
  }

  findIndexByTitle(title: string): number {
    return this.findIndex(game => game.title === title || (game.sameGame && game.sameGame.includes(title)));
  };

  getGameByTitle(title: string): Game {
    let index = this.findIndexByTitle(title);
    if (index === -1) {
      this.database.push({
        title: title,
        key: GameDatabaseService.createGameSlug(title),
      });
      index = this.database.length - 1;
    } else {
      this.database[index].key = GameDatabaseService.createGameSlug(this.database[index].title);
    }
    return this.database[index] as Game;
  };

  updateGame(game: Game, gameUpdates: Partial<GameDatabaseRecordInJson>): Game {
    const index = this.findIndex(g => g.key === game.key);
    if (index !== -1) {
      this.database[index] = {
        ...this.database[index],
        ...gameUpdates
      };
      return this.database[index] as Game;
    }
    throw new Error(`Game with key ${game.key} not found in database.`);
  };

  async save(path: string): Promise<void> {
    return await fs.promises.writeFile(path, JSON.stringify(this.database, null, 2));
  }
}

export default GameDatabaseService;
export type { Game };