import { JSDOM } from 'jsdom';
import { Platform } from '../lib/types';

type PlatformProgress = {
  _type: 'progress';
  platform: Platform;
  title: string;
  progress: number;
};

const fetchTrueSteamAchievementsProgress = async (username: string): Promise<PlatformProgress[] | null> => {
  const trueSteamAchievementsResponse = await fetch(`https://truesteamachievements.com/gamer/${username}/games`);
  if (!trueSteamAchievementsResponse.ok) {
    console.error('Error fetching TrueSteamAchievements for username:', username);
    return null;
  }

  const gamePage = await trueSteamAchievementsResponse.text();
  return parseGamesPage('steam', gamePage);
};

const fetchTrueTrophiesProgress = async (username: string): Promise<PlatformProgress[] | null> => {
  const trueTrophiesResponse = await fetch(`https://www.truetrophies.com/gamer/${username}/games`);
  if (!trueTrophiesResponse.ok) {
    console.error('Error fetching TrueTrophies for username:', username);
    return null;
  }
  const gamePage = await trueTrophiesResponse.text();
  return parseGamesPage('playstation', gamePage);
};

const fetchTrueAchievementsProgress = async (username: string): Promise<PlatformProgress[] | null> => {
  const trueAchievementsResponse = await fetch(`https://www.trueachievements.com/gamer/${username}/games`);
  if (!trueAchievementsResponse.ok) {
    console.error('Error fetching TrueTrophies for username:', username);
    return null;
  }
  const gamePage = await trueAchievementsResponse.text();
  return parseGamesPage('playstation', gamePage);
};

const parseGamesPage = (platform: Platform, gamesPage: string): PlatformProgress[] => {
  const achievementProgress: PlatformProgress[] = [];
  const dom = new JSDOM(gamesPage);
  const gamesTable = dom.window.document.querySelector('#oGamerGamesList');
  gamesTable?.querySelectorAll('tr').forEach((row) => {
    const title = row.querySelector('.smallgame')?.textContent?.trim() || null;
    if (title) {
      const progress = Number(row.querySelector('.hwrs')?.textContent?.trim().replace('%', '')) || -1;
      achievementProgress.push({_type: 'progress', platform, title, progress});
    }
  });
  return achievementProgress;
};

export { fetchTrueSteamAchievementsProgress, fetchTrueTrophiesProgress, fetchTrueAchievementsProgress };
export type { PlatformProgress };