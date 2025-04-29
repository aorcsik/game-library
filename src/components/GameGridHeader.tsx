import { JSX, memo } from 'react';
import { Platform, PlatformList } from '../lib/types';

interface GameGridHeaderProps {
  platforms: PlatformList;
}

const GameGridHeader = ({ platforms }: GameGridHeaderProps): JSX.Element => {
  return (
    <div className="games-header">
      <div className="game-row-title"></div>
      {Object.keys(platforms).map((k) => {
        const platform = k as Platform;
        let title = `${platforms[platform].count} games`;
        
        if (platform === 'playstation') {
          title = `${platforms[platform].count} games (${platforms[platform].plus} in PS Plus Library)`;
        }
        
        if (platform === 'appstore') {
          title = `${platforms[platform].count} games (${platforms[platform].netflix} in Apple Arcade)`;
        }
        
        return (
          <h2 
            key={platform}
            className={`game-header-cell platform-${platform}`} 
            data-game-platform={platform}
          >
            <span className="platform-count" title={title}>
              {platforms[platform].count}
            </span>
          </h2>
        );
      })}
    </div>
  );
};

export default memo(GameGridHeader);
