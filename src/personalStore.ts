import {
  PERSONAL_KEY_PREFIX, PERSONAL_PLATFORMS, PERSONAL_RATINGS, PROGRESS_STATES, personalKey, summarizePersonal,
  type PersonalEntry, type PersonalRating, type PersonalSummary, type ProgressState,
} from './personal';

export const getPersonalEntries = async (kv: KVNamespace, gameKey: string): Promise<PersonalEntry[]> =>
  (await kv.get<PersonalEntry[]>(personalKey(gameKey), 'json')) ?? [];

export const listPersonalSummaries = async (kv: KVNamespace): Promise<Map<string, PersonalSummary>> => {
  const summaries = new Map<string, PersonalSummary>();
  let cursor: string | undefined;
  do {
    const page = await kv.list<PersonalSummary>({ prefix: PERSONAL_KEY_PREFIX, cursor });
    for (const key of page.keys) {
      if (!key.metadata) continue;
      summaries.set(key.name.slice(PERSONAL_KEY_PREFIX.length), key.metadata);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return summaries;
};

export const getAllPersonalEntries = async (kv: KVNamespace): Promise<{ gameKey: string; entries: PersonalEntry[] }[]> => {
  const summaries = await listPersonalSummaries(kv);
  const records = await Promise.all([...summaries.keys()].map(async gameKey => ({
    gameKey,
    entries: await getPersonalEntries(kv, gameKey),
  })));
  return records.filter(record => record.entries.length > 0);
};

export const savePersonalEntries = async (kv: KVNamespace, gameKey: string, entries: PersonalEntry[]): Promise<PersonalSummary> => {
  const summary = summarizePersonal(entries);
  await kv.put(personalKey(gameKey), JSON.stringify(entries), { metadata: summary });
  return summary;
};

export const deletePersonalEntry = async (kv: KVNamespace, gameKey: string, entryId: string): Promise<PersonalSummary> => {
  const entries = (await getPersonalEntries(kv, gameKey)).filter(entry => entry.id !== entryId);
  if (entries.length) return savePersonalEntries(kv, gameKey, entries);
  await kv.delete(personalKey(gameKey));
  return summarizePersonal([]);
};

export type PersonalDraft = {
  date: string;
  platform: string;
  state: string;
  rating: string;
  note: string;
};

export const validatePersonalDraft = (form: FormData): { entry?: PersonalEntry; errors: string[]; draft: PersonalDraft } => {
  const value = (key: string): string => {
    const v = form.get(key);
    return typeof v === 'string' ? v.trim() : '';
  };
  const date = value('date');
  const platform = value('platform');
  const state = value('state');
  const ratingText = value('rating');
  const note = value('note');
  const draft = { date, platform, state, rating: ratingText, note };
  const errors: string[] = [];
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(parsedDate.getTime()) || !parsedDate.toISOString().startsWith(date)) {
    errors.push('Enter a valid date.');
  }
  if (!(PERSONAL_PLATFORMS as readonly string[]).includes(platform)) errors.push('Choose a platform.');
  if (state && !(PROGRESS_STATES as readonly { key: string }[]).some(option => option.key === state)) errors.push('Choose a valid progress state.');
  const ratingNumber = ratingText === '' ? undefined : Number(ratingText);
  if (ratingNumber !== undefined && !(PERSONAL_RATINGS as readonly { value: number }[]).some(option => option.value === ratingNumber)) {
    errors.push('Choose a valid rating.');
  }
  if (note.length > 4000) errors.push('Notes must be 4000 characters or fewer.');
  if (!state && ratingNumber === undefined && !note) errors.push('Add a note, progress state or rating.');
  if (errors.length || ratingText !== '' && ratingNumber === undefined) return { errors, draft };
  return {
    entry: {
      id: crypto.randomUUID().replaceAll('-', ''),
      date,
      platform,
      ...(state ? { state: state as ProgressState } : {}),
      ...(ratingNumber !== undefined ? { rating: ratingNumber as PersonalRating } : {}),
      ...(note ? { note } : {}),
      recordedAt: new Date().toISOString(),
    },
    errors,
    draft,
  };
};
