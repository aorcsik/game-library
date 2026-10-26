import { gameKey, SOURCES, toGameMeta, type Game } from '../games.ts';
import { getGame, saveRefreshedGame } from '../gamedb.ts';
import { needsGameRefresh, refreshGame, significantSourceData, type RefreshResult } from './refresh.ts';

const LOCK_TIMEOUT = 2 * 60 * 1000;
const active = new Set<string>();

export const claimGameRefresh = async (kv: KVNamespace, key: string, automatic = false, now = Date.now()): Promise<Game | null> => {
  if (active.has(key)) return null;
  active.add(key);
  let claimed = false;
  try {
    const game = await getGame(kv, key);
    if (!game || automatic && !needsGameRefresh(game, now)) return null;
    if (game.refreshLock && now - Date.parse(game.refreshLock.startedAt) < LOCK_TIMEOUT) return null;
    const locked: Game = { ...game, refreshLock: { token: crypto.randomUUID(), startedAt: new Date(now).toISOString() } };
    await kv.put(gameKey(key), JSON.stringify(locked), { metadata: toGameMeta(locked) });
    claimed = true;
    return locked;
  } finally {
    if (!claimed) active.delete(key);
  }
};

export const runClaimedGameRefresh = async (
  kv: KVNamespace, locked: Game, options: { maxAgeDays: number; force?: boolean },
): Promise<RefreshResult> => {
  const token = locked.refreshLock?.token;
  if (!token) throw new Error(`Game ${locked.key} has no refresh lock.`);
  try {
    const result = await refreshGame(locked, options);
    const latest = await getGame(kv, locked.key);
    if (!latest || latest.refreshLock?.token !== token) throw new Error(`Game ${locked.key} refresh lock was lost before saving.`);
    const merged: Game = { ...latest, updatedAt: result.game.updatedAt };
    delete merged.refreshLock;
    let changed = false;
    const sources = { ...result.sources };
    for (const name of SOURCES) {
      if (sources[name].status !== 'fetched') continue;
      if (latest[name]?.id !== locked[name]?.id) {
        sources[name] = { status: 'error', error: 'Source ID changed during refresh; fetched data was not saved.' };
        continue;
      }
      changed ||= significantSourceData(name, latest[name]?.data) !== significantSourceData(name, result.game[name]?.data);
      Object.assign(merged, { [name]: result.game[name] });
    }
    await saveRefreshedGame(kv, merged, changed);
    return { ...result, game: merged, changed, sources };
  } finally {
    active.delete(locked.key);
    const latest = await getGame(kv, locked.key);
    if (latest?.refreshLock?.token === token) {
      const { refreshLock: _lock, ...unlocked } = latest;
      await kv.put(gameKey(locked.key), JSON.stringify(unlocked), { metadata: toGameMeta(unlocked) });
    }
  }
};
