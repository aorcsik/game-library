import fs from 'fs';
import { client } from './sanity';
import { MultipleMutationResult } from '@sanity/client';
import { colorize } from '../cli/CommandLineTools';
import { GameLibraryConfig } from './Config';

type GameNotes = {
  _type: 'notes';
  title: string;
  completed?: boolean;
  progress?: number;
  rating?: -10 | -1 | 0 | 1 | 2; //-10: watched, -1: disliked, 0: neutral, 1: liked, 2: loved
  wathed?: boolean;
  notes?: string;
};

const getNotesFromSanity = async (): Promise<GameNotes[]> => {
  const query = '*[_type == "notes" ]';
  return client.fetch(query);
};

const saveNotesToSanity = async (gameNotes: GameNotes[]): Promise<MultipleMutationResult> => {
  await client.delete({ query: '*[_type == "notes"]' });
  const sanityTransaction = client.transaction();
  gameNotes.forEach(notes => {
    sanityTransaction.create(notes);
  });
  const result = await sanityTransaction.commit();
  process.stdout.write(colorize('Notes saved to Sanity.\n', 'green'));
  return result;
};

class NotesService {
  private config: GameLibraryConfig;

  constructor(config: GameLibraryConfig) {
    this.config = config;
  }

  async getGameNotes(fromSanity: boolean): Promise<GameNotes[] | null> {
    if (fromSanity) {
      return getNotesFromSanity();
    }

    process.stdout.write(colorize('Updating notes...\n', 'yellow'));
    const notesFile = await fs.promises.readFile(`${this.config.source_dir}/data/notes.json`, 'utf-8');
    const notesData = JSON.parse(notesFile) as { notes: GameNotes[] };

    if (!notesData || !Array.isArray(notesData.notes)) {
      console.error(colorize('Invalid notes data format.', 'red'));
      return null;
    }

    notesData.notes.forEach(note => {
      note._type = 'notes';
    });

    await saveNotesToSanity(notesData.notes);

    return notesData.notes;
  }
}

export default NotesService;
export type { GameNotes };