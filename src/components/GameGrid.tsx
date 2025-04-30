import { Platform, PlatformList, PurchasedGame } from '../lib/PurchaseService';
import GameRowTitle, { getReleaseDate } from './GameRowTitle';
import Image from 'next/image';
import PlatformLogo from './PlatformLogo';
import { memo } from 'react';


interface GameGridProps {
  purchasedGames: PurchasedGame[];
  platforms: PlatformList;
}

const GameGrid: React.FC<GameGridProps> = ({ purchasedGames, platforms }) => {
  const sortedGames = [...purchasedGames].sort((a, b) => {
    if (a.key < b.key) {
      return -1;
    }
    if (a.key > b.key) {
      return 1;
    }
    return 0;
  });

  return sortedGames.map(game => {
    const gameDataProps = {
      'data-game-title': game.key,
      'data-game-release-date': getReleaseDate(game),
      'data-open-critic-tier': game.openCriticData?.tier ? game.openCriticData.tier.toString() : 'n-a',
      'data-open-critic-score': game.openCriticData?.score ? game.openCriticData.score.toString() : '',
      'data-open-critic-critics': game.openCriticData?.critics ? game.openCriticData.critics.toString() : '',
      'data-steam-review-score': game.steamData?.reviewScore ? game.steamData.reviewScore.toString() : '',
      'data-metacritic-score': game.metacriticData?.metacriticScore ? game.metacriticData.metacriticScore.toString() : '',
    };
    
    return (
      <div 
        id={game.key} 
        className="game-row" 
        key={game.key}
        {...gameDataProps}
      >
        <div className="game-row-title">
          <GameRowTitle game={game} />
        </div>
        
        {Object.keys(platforms).map(k => {
          const platform = k as Platform;
          const platformPurchase = game.purchases.find(p => p.platform === platform);
          
          if (platformPurchase) {
            const { title, cover, collection, physical, logo: platformLogo } = platformPurchase;
            
            return (
              <div className={`game-cell game-card game-${platform}`} key={platform}>
                <div className="game-cover">
                  <Image 
                    className="game-cover-image"
                    src={cover} 
                    alt={`${title} cover`}
                    loading="lazy"
                    width={120}
                    height={160}
                  />
                </div>
                <div className="game-info">
                  <div className="game-title">
                    {title}
                    {collection && (
                      <div className="game-collection">({collection})</div>
                    )}
                  </div>
                  <PlatformLogo className={`game-platform${physical ? ' physical' : ''}`} platform={platformLogo} />
                </div>
              </div>
            );
          } else {
            return (
              <div className={`game-cell game-placeholder game-${platform}`} key={platform}>
                <div className="game-info">
                  <PlatformLogo className="game-platform" platform={platform} />
                </div>
              </div>
            );
          }
        })}
      </div>
    );
  });
};

export default memo(GameGrid);
