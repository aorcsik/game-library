import { ReactNode, useRef } from 'react';
import { Platform, PlatformList, PurchasedGame } from '../lib/PurchaseService';
import GameRowTitle from './GameRowTitle';
import Image from 'next/image';
import FontAwesomeIcon from './FontAwesomeIcon';

type GameRowProps = {
  game: PurchasedGame;
  platforms: PlatformList;
};

const GameRow = ({ game, platforms }: GameRowProps): ReactNode => {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div 
      ref={ref}
      id={`game-${game.key}`} 
      className={`game-row ${game.purchases.length === 0 ? 'no-purchases' : ''}`}
      key={game.key}
      onClick={() => {
        if (!ref.current) return;
        ref.current.classList.toggle('game-row-open');
      }}
    >
      <div className="game-row-title">
        <GameRowTitle game={game} />
      </div>
      
      {Object.keys(platforms).map(k => {
        const platform = k as Platform;
        const platformPurchase = game.purchases.find(p => p.platform === platform);
        
        if (platformPurchase) {
          const { title, cover, collection, physical, logo: platformLogo, purchaseDate } = platformPurchase;
          
          return (
            <div className={`game-cell game-card game-${platform}`} key={platform}>
              <div className="game-cover">
                <Image 
                  className="game-cover-image"
                  src={(platform === 'steam' && (game.steamData?.headerImage || cover)) || cover || '/images/pixel.gif'} 
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
                  <div className="game-purchase-date">
                    {purchaseDate ? new Intl.DateTimeFormat('hu-HU').format(new Date(purchaseDate)) : 'No purchase date!'}
                  </div>
                </div>
                {!purchaseDate && (
                  <span className="game-warning">
                    <FontAwesomeIcon icon={['fas', 'warning']} />
                  </span>
                )}
                {physical ? (
                  <span className="physical-wrapper"><i className={`game-platform ${platformLogo}-logo ${physical ? 'physical' : ''}`} /></span>
                ) : (
                  <i className={`game-platform ${platformLogo}-logo ${physical ? 'physical' : ''}`} />
                )}
              </div>
            </div>
          );
        } else {
          return (
            <div className={`game-cell game-placeholder game-${platform}`} key={platform}>
              <div className="game-info">
                <i className={`game-platform ${platform}-logo`} />
              </div>
            </div>
          );
        }
      })}
    </div>
  );
};

export default GameRow;