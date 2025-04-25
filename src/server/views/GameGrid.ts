import { Platform, PlatformList, PurchasedGame } from '../PurchaseService';
import renderGameGridHeader from './GameGridHeader';
import renderGameRowTitle, { getReleaseDate } from './GameRowTitle';


const renderGameGrid = (purchasedGames: PurchasedGame[], platforms: PlatformList): string => {
  let gameGrid = `
    <div class="games-header">
      <div class="game-row-title"></div>
      ${renderGameGridHeader(platforms)}
    </div>
  `;

  purchasedGames.sort((a, b) => {
    if (a.key < b.key) {
      return -1;
    }
    if (a.key > b.key) {
      return 1;
    }
    return 0;
  });

  purchasedGames.forEach(game => {
    const gameDataProps: Record<string, string> = {
      'data-game-release-date': getReleaseDate(game),
      'data-open-critic-tier': game.openCriticData?.tier ? game.openCriticData.tier.toString() : 'n-a',
      'data-open-critic-score': game.openCriticData?.score ? game.openCriticData.score.toString() : '',
      'data-open-critic-critics': game.openCriticData?.critics ? game.openCriticData.critics.toString() : '',
      'data-steam-review-score': game.steamData?.reviewScore ? game.steamData.reviewScore.toString() : '',
      'data-metacritic-score': game.metacriticData?.metacriticScore ? game.metacriticData.metacriticScore.toString() : '',
    };

    gameGrid += `
    <div id="game_${game.key}" class="game-row" ${Object.keys(gameDataProps).map(key => `${key}="${gameDataProps[key]}"`).join(' ')}>
      <div class="game-row-title">${renderGameRowTitle(game)}</div>`;
    
    Object.keys(platforms).forEach(k => {
      const platform = k as Platform;
      const platformPurchse = game.purchases.find(p => p.platform === platform);
      if (platformPurchse) {
        const title = platformPurchse.title;
        const cover = platformPurchse.cover;
        const collection = platformPurchse.collection;
        const physical = platformPurchse.physical;
        const platformLogo = platformPurchse.logo;

        gameGrid += `
        <div class="game-cell game-card game-${platform}">
          <div class="game-cover"><img class="game-cover-image" src="${cover}" loading="lazy"></div>
          <div class="game-info">
            <div class="game-title">${title}${collection ? "<div class='game-collection'>(" + collection + ')</div>' : ''}</div>
            <img class="game-platform${physical ? ' physical' : ''}" alt="${platforms[platform].name}" src="images/${platformLogo}-logo.svg">
          </div>
        </div>`;
      } else {
        gameGrid += `
        <div class="game-cell game-placeholder game-${platform}">
          <div class="game-info">
            <img class="game-platform" alt="${platforms[platform].name}" src="images/${platform}-logo.svg">
          </div>
        </div>`;
      }  
    });
    gameGrid += `
    </div>`;
  });


  return gameGrid;
};

export default renderGameGrid;