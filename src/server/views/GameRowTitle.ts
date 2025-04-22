import GameDatabaseService, { Game } from '../GameDatabaseService';

const getReleaseDate = (game: Game): string => {
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

const renderGameRowTitle = (game: Game): string => {
  const openCriticTier = game.openCriticData?.tier ? game.openCriticData.tier : '';
  const openCriticTierClass = openCriticTier ? 'tier-' + openCriticTier.toLowerCase().replace(/\s+/g, '-') : '';
  const openCriticScore = game.openCriticData?.score ? game.openCriticData.score : '';
  const openCriticCritics = game.openCriticData?.critics ? `${game.openCriticData.critics}%` : '';
  const openCriticUrl = game.openCriticId && game.openCriticId !== 'skip' ? `https://opencritic.com/game/${game.openCriticId}` : null;
  const openCriticLink = openCriticUrl ? `<a href="${openCriticUrl}" target="_blank" class="open-critic-link">` +
    `<span class="open-critic-tier ${openCriticTierClass}" title="${openCriticTier}">${openCriticTier}</span>` +
    `<span class="open-critic-score ${openCriticTierClass}">${openCriticScore}</span>` +
    `<span class="open-critic-critics ${openCriticTierClass}">${openCriticCritics}</span>` +
  '</a>' : '<span class="open-critic-link disabled">' +
    `<span class="open-critic-tier ${openCriticTierClass}" title="${openCriticTier}">${openCriticTier}</span>` +
    `<span class="open-critic-score ${openCriticTierClass}">${openCriticScore}</span>` +
    `<span class="open-critic-critics ${openCriticTierClass}">${openCriticCritics}</span>` +
  '</span>';

  let metacriticClass = 'tbd';
  if (game.metacriticData?.metacriticScore) {
    if (game.metacriticData.metacriticScore >= 75) metacriticClass = 'good';
    else if (game.metacriticData.metacriticScore >= 50) metacriticClass = 'mixed';
    else if (game.metacriticData.metacriticScore >= 0) metacriticClass = 'bad';
  }

  const metacriticLink = game.metacriticUrl ? `<a href="${game.metacriticUrl}" target="_blank" class="metacritic-link">` +
    `<span class="metacritic-score ${metacriticClass}">${game.metacriticData?.metacriticScore || 'tbd'}</span>` +
  '</a>' : '<span class="metacritic-link disabled">' +
    '<span class="metacritic-score"></span>' +
  '</span>';

  const releaseDate = getReleaseDate(game);

  let steamReviewScoreClass = 'steam-review';
  if (game.steamData?.reviewScore) {
    if (game.steamData.reviewScore < 5) steamReviewScoreClass = 'steam-review negative';
    if (game.steamData.reviewScore === 5) steamReviewScoreClass = 'steam-review mixed';
    if (game.steamData.reviewScore > 5) steamReviewScoreClass = 'steam-review positive';
  }
  const steamStoreUrl = game.steamAppId ? `https://store.steampowered.com/app/${game.steamAppId}/` : '';
  const steamReviewScoreDescription = game.steamData?.reviewScoreDescription ? game.steamData?.reviewScoreDescription : '';

  let statusCheckbox = '<i class="fa-regular fa-square"></i>';
  let statusClass = '';
  if (game.playing) {
    statusCheckbox = '<i class="fa-regular fa-square-ellipsis"></i>';
  }
  if (game.played) {
    statusCheckbox = '<i class="fa-solid fa-square-check"></i>';
    statusClass = 'played';
  }
  if (game.liked) {
    statusCheckbox = '<i class="fa-solid fa-square-heart"></i>';
    statusClass = 'played';
  }
  let favouriteCheckbox = '<i class="fa-regular fa-heart"></i>';
  if (game.favourite) {
    favouriteCheckbox = '<i class="fa-solid fa-heart"></i>';
  }
  if (game.interesting) {
    favouriteCheckbox = '<i class="fa-regular fa-hand-point-right"></i>';
  }

  return '<span class="game-profile-info">' + 
      favouriteCheckbox +
      statusCheckbox +
    '</span>' +
    openCriticLink +
    metacriticLink +
    `<span class="game-title ${statusClass}" title="${game.title}">
      ${GameDatabaseService.formatTitle(game.title)}
      <span class="release-date">${releaseDate ? `(${(new Date(releaseDate)).getFullYear()})` : ''}</span>
      <a href="${steamStoreUrl}" target="_blank" class="${steamReviewScoreClass}">${steamReviewScoreDescription}</a>
    </span>`;
};

export default renderGameRowTitle;
export { getReleaseDate };