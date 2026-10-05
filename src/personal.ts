import { PLATFORM_GROUPS } from './model';

export const PROGRESS_STATES = [
  { key: 'backlog', rank: 0, label: 'Backlog', icon: 'circle-bookmark', tone: 'backlog' },
  { key: 'playing', rank: 1, label: 'Playing', icon: 'circle-play', tone: 'playing' },
  { key: 'paused', rank: 1, label: 'Paused', icon: 'circle-pause', tone: 'paused' },
  { key: 'tried', rank: 2, label: 'Tried', icon: 'circle-camera', tone: 'tried' },
  { key: 'quit', rank: 2, label: 'Quit', icon: 'circle-xmark', tone: 'quit' },
  { key: 'beaten', rank: 3, label: 'Beaten', icon: 'circle-check', tone: 'beaten' },
  { key: 'completed', rank: 4, label: 'Completed', icon: 'circle-star', tone: 'completed' },
] as const;

export type ProgressState = typeof PROGRESS_STATES[number]['key'];

export const PERSONAL_RATINGS = [
  { value: -1, label: 'Interested', icon: 'heart', tone: 'rating--1' },
  { value: 0, label: 'Awful', icon: 'poop', tone: 'rating-0' },
  { value: 1, label: 'Disliked', icon: 'thumbs-down', tone: 'rating-1' },
  { value: 2, label: 'Liked', icon: 'thumbs-up', tone: 'rating-2' },
  { value: 3, label: 'Loved', icon: 'star', tone: 'rating-3' },
] as const;

export type PersonalRating = typeof PERSONAL_RATINGS[number]['value'];

export const PERSONAL_PLATFORMS = [...new Set([
  ...Object.values(PLATFORM_GROUPS).flat(),
  'origin', 'ea', 'playstation-ps3', 'playstation-plus-ps3', 'apple-arcade', 'other',
])].sort();

export type PersonalEntry = {
  id: string;
  date: string;
  platform: string;
  state?: ProgressState;
  rating?: PersonalRating;
  note?: string;
  recordedAt: string;
};

export type ProgressMark = { state: ProgressState; date: string; platform: string };
export type RatingMark = { rating: PersonalRating; date: string; platform: string };

export type PersonalSummary = {
  latest?: ProgressMark;
  peak?: ProgressMark;
  rating?: RatingMark;
  entries: number;
};

export const PERSONAL_KEY_PREFIX = 'state:';
export const personalKey = (gameKey: string): string => `${PERSONAL_KEY_PREFIX}${gameKey}`;

const byRecent = <T extends { date: string; recordedAt: string }>(a: T, b: T): number =>
  b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt);

export const summarizePersonal = (entries: PersonalEntry[]): PersonalSummary => {
  const progress = entries.filter((e): e is PersonalEntry & { state: ProgressState } => !!e.state);
  const latest = [...progress].sort(byRecent)[0];
  const peak = [...progress].sort((a, b) => {
    const rank = PROGRESS_STATES.find(s => s.key === b.state)!.rank - PROGRESS_STATES.find(s => s.key === a.state)!.rank;
    return rank || byRecent(a, b);
  })[0];
  const rating = [...entries].filter((e): e is PersonalEntry & { rating: PersonalRating } => e.rating !== undefined).sort(byRecent)[0];
  return {
    ...(latest ? { latest: { state: latest.state, date: latest.date, platform: latest.platform } } : {}),
    ...(peak ? { peak: { state: peak.state, date: peak.date, platform: peak.platform } } : {}),
    ...(rating ? { rating: { rating: rating.rating, date: rating.date, platform: rating.platform } } : {}),
    entries: entries.length,
  };
};
