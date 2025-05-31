import { formatTitle } from '../lib/tools';
import { Game } from '../lib/schema';
import { JSX } from 'react';
import FontAwesomeIcon from './FontAwesomeIcon';
import GameProgressBar from './GameProgressBar';


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

interface GameRowTitleProps {
  game: Game;
}

const GameRowTitle = ({ game }: GameRowTitleProps): JSX.Element => {
  // OpenCritic data
  const openCriticTier = game.openCriticData?.tier ? game.openCriticData.tier : '';
  const openCriticTierClass = openCriticTier ? `tier-${openCriticTier.toLowerCase().replace(/\s+/g, '-')}` : '';
  const openCriticScore = game.openCriticData?.score ? game.openCriticData.score : '';
  const openCriticCritics = game.openCriticData?.critics ? `${game.openCriticData.critics}%` : '';
  const openCriticUrl = game.openCriticId && game.openCriticId !== 'skip' ? `https://opencritic.com/game/${game.openCriticId}` : null;
  
  // Metacritic data
  let metacriticClass = 'tbd';
  if (game.metacriticData?.metacriticScore) {
    if (game.metacriticData.metacriticScore >= 75) metacriticClass = 'good';
    else if (game.metacriticData.metacriticScore >= 50) metacriticClass = 'mixed';
    else if (game.metacriticData.metacriticScore >= 0) metacriticClass = 'bad';
  }
  
  // Release date
  const releaseDate = getReleaseDate(game);
  
  // Steam data
  let steamReviewScoreClass = 'steam-review';
  if (game.steamData?.reviewScore) {
    if (game.steamData.reviewScore < 5) steamReviewScoreClass = 'steam-review negative';
    if (game.steamData.reviewScore === 5) steamReviewScoreClass = 'steam-review mixed';
    if (game.steamData.reviewScore > 5) steamReviewScoreClass = 'steam-review positive';
  }
  const steamStoreUrl = game.steamAppId ? `https://store.steampowered.com/app/${game.steamAppId}/` : '';
  const steamReviewScoreDescription = game.steamData?.reviewScoreDescription ?? '';
  const steamReviewScoreTooltip = game.steamData?.reviewScoreTooltip ?? '';
  
  // Game status indicators
  const statusClass = '';
  // let statusIcon = <FontAwesomeIcon icon={['far', 'square']} aria-hidden="true" />;
  // if (game.playing) {
  //   statusIcon = <FontAwesomeIcon icon={['far', 'square-ellipsis']} aria-hidden="true" />;
  // }
  // if (game.played) {
  //   statusIcon = <FontAwesomeIcon icon={['fas', 'square-check']} aria-hidden="true" />;
  //   statusClass = 'played';
  // }
  // if (game.liked) {
  //   statusIcon = <FontAwesomeIcon icon={['fas', 'square-heart']} aria-hidden="true" />;
  //   statusClass = 'played';
  // }
  
  // let favoriteIcon = <FontAwesomeIcon icon={['far', 'heart']} aria-hidden="true" />;
  // if (game.favourite) {
  //   favoriteIcon = <FontAwesomeIcon icon={['fas', 'heart']} aria-hidden="true" />;
  // }
  // if (game.interesting) {
  //   favoriteIcon = <FontAwesomeIcon icon={['far', 'hand-point-right']} aria-hidden="true" />;
  // }

  return (
    <>
      <span className="game-profile-info">
        {/* <span aria-label={game.favourite ? 'Favorite' : game.interesting ? 'Interesting' : 'Not marked'}>
          {favoriteIcon}
        </span>
        <span aria-label={game.played ? 'Played' : game.playing ? 'Playing' : game.liked ? 'Liked' : 'Not played'}>
          {statusIcon}
        </span> */}
        <span aria-label="Toggle details" className='toggle-details'>
          <FontAwesomeIcon icon={['fas', 'chevron-down']} aria-hidden="true" />
        </span>
      </span>
      
      {openCriticUrl ? (
        <a href={openCriticUrl} target="_blank" rel="noreferrer" className="open-critic-link">
          <span className={`open-critic-tier ${openCriticTierClass}`} title={openCriticTier}>{openCriticTier}</span>
          <span className={`open-critic-score ${openCriticTierClass}`}>{openCriticScore}</span>
          <span className={`open-critic-critics ${openCriticTierClass}`}>{openCriticCritics}</span>
        </a>
      ) : (
        <span className="open-critic-link disabled">
          <span className={`open-critic-tier ${openCriticTierClass}`} title={openCriticTier}>{openCriticTier}</span>
          <span className={`open-critic-score ${openCriticTierClass}`}>{openCriticScore}</span>
          <span className={`open-critic-critics ${openCriticTierClass}`}>{openCriticCritics}</span>
        </span>
      )}
      
      {game.metacriticUrl ? (
        <a href={game.metacriticUrl} target="_blank" rel="noreferrer" className="metacritic-link">
          <span className={`metacritic-score ${metacriticClass}`}>
            {game.metacriticData?.metacriticScore || 'tbd'}
          </span>
        </a>
      ) : (
        <span className="metacritic-link disabled">
          <span className="metacritic-score"></span>
        </span>
      )}
      
      <span className={`game-title ${statusClass}`} title={game.title}>
        {game.progress > -1 && <GameProgressBar progress={game.progress} />}
        <span>
          {formatTitle(game.title)}
          {' '}
          <span className="release-date">
            {releaseDate ? `(${(new Date(releaseDate)).getFullYear()})` : ''}
          </span>
        </span>
        {steamStoreUrl && (
          <a 
            href={steamStoreUrl} 
            target="_blank" 
            rel="noreferrer" 
            title={steamReviewScoreTooltip}
            className={steamReviewScoreClass}
          >
            {steamReviewScoreDescription}
          </a>
        )}
      </span>
    </>
  );
};

export default GameRowTitle;