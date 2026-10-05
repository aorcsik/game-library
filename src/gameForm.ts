import type { Game, SourceRef } from './games';

const text = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

const isValidDate = (value: string): boolean => {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

/** '' = not checked (undefined), 'none' = not on this source (null). Keeps fetched data only if the id is unchanged. */
const source = <Id, Data>(
  value: string, previous: SourceRef<Id, Data> | undefined, parse: (v: string) => Id | undefined,
): SourceRef<Id, Data> | undefined | 'invalid' => {
  if (value === '') return undefined;
  const id = value.toLowerCase() === 'none' ? null : parse(value);
  if (id === undefined) return 'invalid';
  return previous && previous.id === id ? previous : { id };
};

export const applyGameForm = (form: FormData, game: Game): { game?: Game; errors: string[] } => {
  const errors: string[] = [];
  const title = text(form, 'title');
  if (!title || title.length > 300) errors.push('Title is required (max 300 characters).');
  const releaseDate = text(form, 'releaseDate');
  if (releaseDate && !isValidDate(releaseDate)) errors.push('Release date must be YYYY-MM-DD.');

  const opencritic = source(text(form, 'opencritic'), game.opencritic, v => (/^\d+\/[\w-]+$/.test(v) ? v : undefined));
  if (opencritic === 'invalid') errors.push('OpenCritic id must look like "3245/140" or be "none".');
  const steam = source(text(form, 'steam'), game.steam, v => (/^\d{1,10}$/.test(v) && Number(v) > 0 ? Number(v) : undefined));
  if (steam === 'invalid') errors.push('Steam app id must be a positive number or "none".');
  const metacritic = source(text(form, 'metacritic'), game.metacritic, v => (/^https:\/\/www\.metacritic\.com\/[a-z]+\/[\w-]+\/?$/.test(v) ? v : undefined));
  if (metacritic === 'invalid') errors.push('Metacritic URL must start with https://www.metacritic.com/ or be "none".');

  const aliases = [...new Set(text(form, 'aliases').split('\n').map(a => a.trim()).filter(Boolean))];
  if (aliases.length > 100 || aliases.some(a => a.length > 300)) errors.push('Too many or too long aliases.');

  if (errors.length || opencritic === 'invalid' || steam === 'invalid' || metacritic === 'invalid') return { errors };
  const updated: Game = { key: game.key, title, updatedAt: new Date().toISOString() };
  if (aliases.length) updated.aliases = aliases;
  if (releaseDate) updated.releaseDate = releaseDate;
  if (opencritic) updated.opencritic = opencritic;
  if (steam) updated.steam = steam;
  if (metacritic) updated.metacritic = metacritic;
  return { game: updated, errors };
};
