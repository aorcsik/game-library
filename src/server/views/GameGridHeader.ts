import { Platform, PlatformList } from '../PurchaseService';


const renderGameGridHeader = (platforms: PlatformList): string => {
  return Object.keys(platforms).map((k) => {
    const platform = k as Platform;
    const title = platform === 'playstation' ? `${platforms[platform].count} games (${platforms[platform].plus} in PS Plus Library)` : `${platforms[platform].count} games`;
    return `<h2 class="game-header-cell platform-${platform}" data-game-platform="${platform}">
      <img class="game-platform" alt="${platforms[platform].name}" src="images/${platform}-logo.svg">
      <strong>${platforms[platform].name}</strong>
      <span class="platform-count" title="${title}">${platforms[platform].count}</span>
    </h2>`;
  }).join('\n');
};

export default renderGameGridHeader;