'use client';

import { ReactNode } from 'react';
import { Game } from '../lib/schema';

const SteamReviewIndicator = ({ game }: { game: Game | null}): ReactNode => {
  // Steam data
  let steamReviewScoreClass = 'steam-review';
  if (game?.steamData?.reviewScore) {
    if (game.steamData.reviewScore < 5) steamReviewScoreClass = 'steam-review negative';
    if (game.steamData.reviewScore === 5) steamReviewScoreClass = 'steam-review mixed';
    if (game.steamData.reviewScore > 5) steamReviewScoreClass = 'steam-review positive';
  }
  const steamStoreUrl = game?.steamAppId && game?.steamAppId !== -1 ? `https://store.steampowered.com/app/${game.steamAppId}/` : null;
  const steamReviewScoreDescription = game?.steamData?.reviewScoreDescription || '';
  const steamReviewScoreTooltip = game?.steamData?.reviewScoreTooltip || '';

  return steamStoreUrl ? <a 
    href={steamStoreUrl} 
    target="_blank" 
    rel="noreferrer" 
    title={steamReviewScoreTooltip}
    className={steamReviewScoreClass}
  >
    {steamReviewScoreDescription}
  </a> : null;
};

export default SteamReviewIndicator;