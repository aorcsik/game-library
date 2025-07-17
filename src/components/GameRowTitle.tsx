import { formatTitle } from '../lib/tools';
import { Game } from '../lib/schema';
import { JSX, useEffect, useState } from 'react';
import FontAwesomeIcon from './FontAwesomeIcon';
import 'react-circular-progressbar/dist/styles.css';
import GameProgressIndicator from './GameProgressIndicator';
import OpenCriticIndicator from './OpenCriticIndicator';
import MetacriticIndicator from './MetacriticIndicator';
import SteamReviewIndicator from './SteamReviewIndicator';
import RatingIndicator from './RatingIndicator';
import WatchedIndicator from './WatchedIndicator';
import { PurchasedGame } from '../lib/PurchaseService';

export const getReleaseDate = (game: Game): Date | null => {
  const dates = [
    game.releaseDate,
    game.metacriticData?.releaseDate,
    game.steamData?.releaseDate,
    game.openCriticData?.releaseDate,
  ].filter(Boolean);

  if (dates.length === 0) return null;

  // Convert to timestamps, filter out invalid dates
  const timestamps = dates
    .map(date => new Date(date).getTime())
    .filter(ts => !isNaN(ts));

  if (timestamps.length === 0) return null;

  const earliest = Math.min(...timestamps);
  return new Date(earliest);
};

export const getPurchaseDate = (game: PurchasedGame): Date | null => {
  const purchaseDates = game.purchases
    .filter(p => p.purchaseDate)
    .map(p => new Date(p.purchaseDate).getTime())
    .filter(ts => !isNaN(ts));

  if (purchaseDates.length === 0) return null;

  const earliestPurchase = Math.min(...purchaseDates);
  return new Date(earliestPurchase);
};

type GameRowTitleProps = {
  game: PurchasedGame;
}

const GameRowTitle = ({ game }: GameRowTitleProps): JSX.Element => {
  const [clientLoaded, setClientLoaded] = useState(false);
  
  // Release date
  const releaseDate = getReleaseDate(game);
  
  // Purchae date
  // const purchaseDate = game.purchases ? getPurchaseDate(game) : null;

  useEffect(() => {
    setClientLoaded(true);
  }, []);

  const releaseYear = releaseDate?.getFullYear() ?? '';
  const title = formatTitle(game.title).replace(new RegExp(`\\(${releaseYear}\\)$`), '').trim();

  return (
    <>
      <span className="game-profile-info">
        {clientLoaded && <WatchedIndicator game={game} />}
        {clientLoaded && <RatingIndicator game={game} />}
        {clientLoaded && <GameProgressIndicator game={game} />}
        <span aria-label="Toggle details" className='toggle-details'>
          <FontAwesomeIcon icon={['fas', 'chevron-down']} aria-hidden="true" />
        </span>
      </span>
      
      <OpenCriticIndicator game={clientLoaded ? game : null} />
      <MetacriticIndicator game={clientLoaded ? game : null} />
      <span className={'game-title'} title={game.title}>
        <span>
          {`${title} `}
          <span className="release-date">
            {`(${releaseYear})`}
          </span>
        </span>
        <span className="game-metadata">
          <SteamReviewIndicator game={clientLoaded ? game : null} />
          {game.metacriticData?.genres?.length > 0 ? <span className="game-genres">
            {game.metacriticData.genres.join(', ').replace(/%20/g, '\u00A0')}
          </span> : null}
        </span>
      </span>
    </>
  );
};

export default GameRowTitle;