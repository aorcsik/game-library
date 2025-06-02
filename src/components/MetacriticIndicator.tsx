'use client';

import { JSX } from 'react';
import { Game } from '../lib/schema';

const MetacriticIndicator = ({game} : {game: Game | null}): JSX.Element => {
  // Metacritic data
  const metacriticUrl = game && game.metacriticUrl ? game.metacriticUrl : null;
  const metacriticScore = game && game.metacriticData?.metacriticScore ? game.metacriticData.metacriticScore : null;
  let metacriticClass = 'tbd';
  if (game && game.metacriticData?.metacriticScore) {
    if (game.metacriticData.metacriticScore >= 75) metacriticClass = 'good';
    else if (game.metacriticData.metacriticScore >= 50) metacriticClass = 'mixed';
    else if (game.metacriticData.metacriticScore >= 0) metacriticClass = 'bad';
  }

  if (!metacriticScore) {
    return <span className="metacritic-link disabled">
      <span className="metacritic-score"></span>
    </span>;
  }

  return <a href={metacriticUrl} target="_blank" rel="noreferrer" className="metacritic-link">
    <span className={`metacritic-score ${metacriticClass}`}>
      {metacriticScore || 'tbd'}
    </span>
  </a>;
};

export default MetacriticIndicator;