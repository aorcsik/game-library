import fs from 'fs';
import { client } from './sanity';
import { MultipleMutationResult } from '@sanity/client';
import { colorize } from '../cli/CommandLineTools';
import { GameLibraryConfig } from './Config';
import { GameNotes } from './schema';

export type SanityGameNotes = GameNotes & {
  _type: 'notes';
  title: string;
  notesJSON?: string;
};

const getNotesFromSanity = async (): Promise<SanityGameNotes[]> => {
  const query = '*[_type == "notes" ]';
  return client.fetch(query);
};

const saveNotesToSanity = async (gameNotes: SanityGameNotes[]): Promise<MultipleMutationResult> => {
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

    async loadGameNoteFiles(notes: SanityGameNotes[], index: number = 0): Promise<SanityGameNotes[]> {
    if (index >= notes.length) {
      return notes;
    }
    const note = notes[index];
    if (note.notesJSON) {
      const dataDir = `${this.config.source_dir}/data/`;
      try {
        process.stdout.write(colorize(`Loading notes for ${note.title}...\n`, 'yellow'));
        const filePath = `${dataDir}${note.notesJSON}`;
        const fileContent = await fs.promises.readFile(filePath, 'utf-8');
        note.notesJSON = JSON.stringify(JSON.parse(fileContent), null, 2);
        process.stdout.write(colorize(`Notes for ${note.title} loaded successfully.\n`, 'green'));
      } catch (error) {
        console.error(colorize(`Error reading notes file for ${note.title}: ${error instanceof Error ? error.message : String(error)}`, 'red'));
        note.notesJSON = '';
      }
    } else {
      note.notesJSON = '';
    }
    return this.loadGameNoteFiles(notes, index + 1);
  }

  async getGameNotes(fromSanity: boolean): Promise<SanityGameNotes[] | null> {
    if (fromSanity) {
      return getNotesFromSanity();
    }

    const dataDir = `${this.config.source_dir}/data/`;

    process.stdout.write(colorize('Updating notes...\n', 'yellow'));
    const notesFile = await fs.promises.readFile(`${dataDir}notes.json`, 'utf-8');
    const notesData = JSON.parse(notesFile) as { notes: SanityGameNotes[] };

    if (!notesData || !Array.isArray(notesData.notes)) {
      console.error(colorize('Invalid notes data format.', 'red'));
      return null;
    }

    notesData.notes.forEach(note => {
      note._type = 'notes';
    });

    await this.loadGameNoteFiles(notesData.notes);

    await saveNotesToSanity(notesData.notes);

    return notesData.notes;
  }
}

export default NotesService;
