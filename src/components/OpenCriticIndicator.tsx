'use client';

import { JSX } from 'react';
import { Game } from '../lib/schema';

const OpenCriticIndicator = ({ game }: {game: Game | null}): JSX.Element => {
  // OpenCritic data
  const openCriticTier = game && game.openCriticData?.tier ? game.openCriticData.tier : '';
  const openCriticTierClass = openCriticTier ? `tier-${openCriticTier.toLowerCase().replace(/\s+/g, '-')}` : '';
  const openCriticScore = game && game.openCriticData?.score ? game.openCriticData.score : '';
  const openCriticCritics = game && game.openCriticData?.critics ? `${game.openCriticData.critics}%` : '';
  const openCriticUrl = game && game.openCriticId && game.openCriticId !== 'skip' ? `https://opencritic.com/game/${game.openCriticId}` : null;

  const openCriticElements = openCriticTier ? <>
    <span className={`open-critic-tier ${openCriticTierClass}`} title={openCriticTier}>{openCriticTier}</span>
    <span className={`open-critic-score ${openCriticTierClass}`}>{openCriticScore}</span>
    <span className={`hidden open-critic-critics ${openCriticTierClass}`}>{openCriticCritics}</span>
  </> : <>
    <span className="open-critic-tier"></span>
    <span className="open-critic-score"></span>
    <span className="hidden open-critic-critics"></span>
  </>;

  if (!openCriticUrl) {
    return <span className="open-critic-link disabled">{openCriticElements}</span>;
  }

  return <a href={openCriticUrl} target="_blank" rel="noreferrer" title={`${openCriticCritics} of critics recommend`} className="open-critic-link">{openCriticElements}</a>;
};

export default OpenCriticIndicator;