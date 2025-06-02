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


export const getReleaseDate = (game: Game): string => {
  if (game.openCriticData && game.openCriticData.releaseDate) {
    return game.openCriticData.releaseDate;
  }
  if (game.steamData && game.steamData.releaseDate) {
    return game.steamData.releaseDate;
  }
  if (game.metacriticData && game.metacriticData.releaseDate) {
    return game.metacriticData.releaseDate;
  }
  if (game.releaseDate) {
    return game.releaseDate;
  }
  return '';
};

type GameRowTitleProps = {
  game: Game;
}

const GameRowTitle = ({ game }: GameRowTitleProps): JSX.Element => {
  const [clientLoaded, setClientLoaded] = useState(false);
  
  // Release date
  const releaseDate = getReleaseDate(game);
  
  // Game status indicators
  

  useEffect(() => {
    setClientLoaded(true);
  }, []);

  return (
    <>
      <span className="game-profile-info">
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
          {formatTitle(game.title)}
          {' '}
          <span className="release-date">
            {releaseDate ? `(${(new Date(releaseDate)).getFullYear()})` : ''}
          </span>
        </span>
        <SteamReviewIndicator game={clientLoaded ? game : null} />
      </span>
    </>
  );
};

export default GameRowTitle;