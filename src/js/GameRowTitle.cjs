class GameRowTitle
{
  render(data) {
    const openCriticTier = data.openCriticTier ? data.openCriticTier : "";
    const openCriticTierClass = openCriticTier ? "tier-" + openCriticTier.toLowerCase().replace(/\s+/g, "-") : "";
    const openCriticScore = data.openCriticScore ? data.openCriticScore : "";
    const openCriticCritics = data.openCriticCritics ? `${data.openCriticCritics}%` : "";
    const openCriticUrl = data.openCriticId && data.openCriticId !== "skip" ? `https://opencritic.com/game/${data.openCriticId}` : "";
    const openCriticLink = data.openCriticId && data.openCriticId !== "skip" ? `<a href="${openCriticUrl}" target="_blank" class="open-critic-link">` +
      `<span class="open-critic-tier ${openCriticTierClass}" title="${openCriticTier}">${openCriticTier}</span>` +
      `<span class="open-critic-score ${openCriticTierClass}">${openCriticScore}</span>` +
      `<span class="open-critic-critics ${openCriticTierClass}">${openCriticCritics}</span>` +
    `</a>` : `<span class="open-critic-link disabled">` +
      `<span class="open-critic-tier ${openCriticTierClass}" title="${openCriticTier}">${openCriticTier}</span>` +
      `<span class="open-critic-score ${openCriticTierClass}">${openCriticScore}</span>` +
      `<span class="open-critic-critics ${openCriticTierClass}">${openCriticCritics}</span>` +
    `</span>`;

    let metacriticClass = "";
    if (data.metacriticScore && parseInt(data.metacriticScore, 10) >= 75) metacriticClass = "good";
    else if (data.metacriticScore && parseInt(data.metacriticScore, 10) >= 50) metacriticClass = "mixed";
    else if (data.metacriticScore && parseInt(data.metacriticScore, 10) >= 0) metacriticClass = "bad";

    const metacriticLink = data.metacriticUrl ? `<a href="${data.metacriticUrl}" target="_blank" class="metacritic-link">` +
      `<span class="metacritic-score ${metacriticClass}">${data.metacriticScore}</span>` +
    `</a>` : `<span class="metacritic-link disabled">` +
      `<span class="metacritic-score"></span>` +
    `</span>`;

    const releaseDate = data.gameReleaseDate ? new Date(data.gameReleaseDate) : null;

    let steamReviewScoreClass = "steam-review";
    if (data.steamReviewScore && parseInt(data.steamReviewScore, 10) === 5) steamReviewScoreClass = "steam-review mixed";
    if (data.steamReviewScore && parseInt(data.steamReviewScore, 10) > 5) steamReviewScoreClass = "steam-review positive";
    const steamStoreUrl = data.steamAppId ? `https://store.steampowered.com/app/${data.steamAppId}/` : "";
    const steamReviewScoreDescription = data.steamReviewScoreDescription ? data.steamReviewScoreDescription : ""

    return openCriticLink +
      metacriticLink +
      `<span class="game-title">
        ${data.gameTitle}
        <span class="release-date">${releaseDate ? `(${releaseDate.getFullYear()})` : ""}</span>
        <a href="${steamStoreUrl}" target="_blank" class="${steamReviewScoreClass}">${steamReviewScoreDescription}</a>
      </span>`;
  }
}

module.exports = GameRowTitle;