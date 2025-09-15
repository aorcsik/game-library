import fs from 'fs';
import { JSDOM } from 'jsdom';
import { Platform } from '../lib/types';

type PlatformProgress = {
  _type: 'progress';
  platform: Platform;
  title: string;
  progress: number;
};

const getLocalFilePath = (username: string, platform: Platform): string => {
  return `./data/progress/${username}_${platform}.html`;
};

const getRemotePageUrl = (username: string, platform: Platform): string => {
  switch (platform) {
    case 'steam':
      return `https://truesteamachievements.com/gamer/${username}/games`;
    case 'playstation':
      return `https://www.truetrophies.com/gamer/${username}/games`;
    case 'xbox':
      return `https://www.trueachievements.com/gamer/${username}/games`;
    default:
      throw new Error('Unknown platform');
  }
};

const fetchProgress = async (username: string, platform: Platform): Promise<PlatformProgress[] | null> => {
  const localFilePath = getLocalFilePath(username, platform);
  const remoteResponse = await fetch(getRemotePageUrl(username, platform));
  let gamePage = '';
  if (remoteResponse.ok) {
    console.info(`Fetching ${platform} progress for username: ${username}`);
    gamePage = await remoteResponse.text();
    await fs.promises.writeFile(localFilePath, gamePage, 'utf-8');
  } else {
    console.error(`Error fetching ${platform} progress for username: ${username}`);
    console.error('Response status:', remoteResponse.status);
    console.info('Trying local file...');
    try {
      gamePage = await fs.promises.readFile(localFilePath, 'utf-8');
    } catch (err) {
      console.error('Error reading local file:', err);
      return null;
    }
  }
  return parseGamesPage('steam', gamePage);
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

export { fetchProgress };
export type { PlatformProgress };