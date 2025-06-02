import { client } from './sanity';
import { PlatformProgress, fetchTrueAchievementsProgress, fetchTrueSteamAchievementsProgress, fetchTrueTrophiesProgress } from '../cli/ProgressFetcherService';
import { Platform } from './types';
import { MultipleMutationResult } from '@sanity/client';
import { colorize } from '../cli/CommandLineTools';
import { GameLibraryConfig } from './Config';

const getProgressFromSanity = async <T extends PlatformProgress>(platform: Platform): Promise<T[]> => {
  const query = `*[_type == "progress" && platform == "${platform}"]`;
  return client.fetch(query);
};

const saveProgressToSanity = async (platform: Platform, platformProgress: PlatformProgress[]): Promise<MultipleMutationResult> => {
  await client.delete({ query: '*[_type == "progress" && platform == $platform]', params: { platform: platform } });
  const sanityTransaction = client.transaction();
  platformProgress.forEach(progress => {
    sanityTransaction.create(progress);
  });
  const result = await sanityTransaction.commit();
  process.stdout.write(colorize(`Progress for ${platform} saved to Sanity.\n`, 'green'));
  return result;
};

class ProgressService {
  private config: GameLibraryConfig;

  constructor(config: GameLibraryConfig) {
    this.config = config;
  }

  async getSteamProgress(fromSanity: boolean): Promise<PlatformProgress[] | null> {
    if (fromSanity) {
      return getProgressFromSanity<PlatformProgress>('steam');
    }

    if (!this.config.steam_username) {
      console.error('Steam username is not set in environment variables.');
      return null;
    }

    process.stdout.write(colorize('Updating Steam progress...\n', 'yellow'));
    const platformProgress = await fetchTrueSteamAchievementsProgress(this.config.steam_username);
    if (platformProgress) {
      await saveProgressToSanity('steam', platformProgress);
    }

    return platformProgress;
  }

  async getPlaystationProgress(fromSanity: boolean): Promise<PlatformProgress[] | null> {
    if (fromSanity) {
      return getProgressFromSanity<PlatformProgress>('playstation');
    }

    if (!this.config.playstation_username) {
      console.error('PlayStation username is not set in environment variables.');
      return null;
    }

    process.stdout.write(colorize('Updating PlayStation progress...\n', 'yellow'));
    const platformProgress = await fetchTrueTrophiesProgress(this.config.playstation_username);
    if (platformProgress) {
      await saveProgressToSanity('playstation', platformProgress);
    }

    return platformProgress;
  }

  async getXboxProgress(fromSanity: boolean): Promise<PlatformProgress[] | null> {
    if (fromSanity) {
      return getProgressFromSanity<PlatformProgress>('xbox');
    }

    if (!this.config.xbox_username) {
      console.error('Xbox username is not set in environment variables.');
      return null;
    }

    process.stdout.write(colorize('Updating Xbox progress...\n', 'yellow'));
    const platformProgress = await fetchTrueAchievementsProgress(this.config.xbox_username);
    if (platformProgress) {
      await saveProgressToSanity('xbox', platformProgress);
    }

    return platformProgress;
  }
}

export default ProgressService;