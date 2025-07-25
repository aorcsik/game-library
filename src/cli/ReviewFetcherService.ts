import { JSDOM } from 'jsdom';
import { MetacriticData, OpenCriricData, SteamData } from '../lib/schema';


const fetchOpenCriticData = async (openCriticId: string): Promise<OpenCriricData | null> => {
  const openCriticResponse = await fetch(`https://opencritic.com/game/${openCriticId}`);
  if (!openCriticResponse.ok) {
    console.error('Error fetching OpenCritic page', openCriticId);
    return null;
  }

  const gamePage = await openCriticResponse.text();
  const dom = new JSDOM(gamePage);

  const titleElement: HTMLElement | null = dom.window.document.querySelector('app-game-overview h1');
  const title = titleElement?.textContent?.trim() || null;
  const coverElement: HTMLSourceElement | null = dom.window.document.querySelector('.header-card picture source[media="(max-width: 991px)"]');
  const cover = coverElement?.srcset || null;
  const tierElement: SVGElement | null = dom.window.document.querySelector('.header-card app-score-orb .score-orb svg');
  const tierMatch = tierElement?.innerHTML.match(/class="(mighty|strong|fair|weak)"/);
  const tier = tierMatch ? tierMatch[1] : null;
  const scoreOrbs: HTMLElement[] = Array.from(dom.window.document.querySelectorAll('.header-card app-score-orb .inner-orb'));
  const score = scoreOrbs.length > 0 && scoreOrbs[0].textContent ? parseInt(scoreOrbs[0].textContent, 10) : null;
  const criticsMatch = scoreOrbs.length > 1 && scoreOrbs[1].textContent && scoreOrbs[1].textContent.trim().match(/(\d+)%/);
  const critics = criticsMatch ? parseInt(criticsMatch[1], 10) : null;
  const releaseDateElement: HTMLElement | null = dom.window.document.querySelector('.platforms');
  const releaseDateMatch = releaseDateElement ? releaseDateElement.innerHTML.match(/Release Date:<\/strong> (\w+ \d+, \d+) -/) : null;
  const releaseDate = releaseDateMatch ? new Date(releaseDateMatch[1]).toISOString() : null;
  return {
    title,
    cover,
    tier,
    score,
    critics,
    releaseDate,
    updated: new Date().toISOString(),
  };
};

const fetchSteamData = async (steamAppId: number): Promise<SteamData | null> => {
  const steamStoreResponse = await fetch(`https://store.steampowered.com/app/${steamAppId}`, {
    headers: {
      'Cookie': 'birthtime=463096801; lastagecheckage=4-September-1984; wants_mature_content=1'
    }
  });

  if (!steamStoreResponse.ok || steamStoreResponse.url.match(new RegExp(`app/${steamAppId}`)) === null) {
    console.error('Error fetching Steam Store page', steamAppId);
    return null;
  }

  const steamStorePage = await steamStoreResponse.text();
  const dom = new JSDOM(steamStorePage);

  if (dom.window.document.querySelector('.apphub_AppName') === null) {
    console.error('Error parsing Steam Store page', steamAppId);
    return null;
  }

  const titleElement: HTMLElement | null = dom.window.document.querySelector('.apphub_AppName');
  const title = titleElement?.textContent?.trim() || null;
  const descriptionElement: HTMLElement | null = dom.window.document.querySelector('.game_description_snippet');
  const description = descriptionElement?.textContent?.trim() || null;
  const metacriticUrlElement: HTMLAnchorElement | null = dom.window.document.querySelector('#game_area_metalink a');
  const metacriticUrl = metacriticUrlElement?.href || null;
  const genresElement: HTMLElement | null = dom.window.document.querySelector('#genresAndManufacturer');
  const genres = Array.from(genresElement?.querySelectorAll('a') || []).map(link => link.href.match(/genre\/(.*?)\//)).map(match => match && match[1]).filter(genre => genre !== null);
  const releaseDateMatch = genresElement?.textContent?.match(/Release Date:\s*(\d+ \w+, \d+)/);
  const releaseDate = releaseDateMatch ? new Date(releaseDateMatch[1]).toISOString() : null;

  const aggregateRatingElement = dom.window.document.querySelector('[itemprop=aggregateRating]');
  const reviewScoreTooltip = aggregateRatingElement?.getAttribute('data-tooltip-html') || '';
  const reviewScoreElement = aggregateRatingElement?.querySelector('.game_review_summary');
  const reviewScoreDescription = reviewScoreElement?.textContent?.trim() || null;
  const reviewScoreMap: Record<string, number> = {
    'Overwhelmingly Positive': 9,
    'Very Positive': 8,
    'Positive': 7,
    'Mostly Positive': 6,
    'Mixed': 5,
    'Mostly Negative': 4,
    'Negative': 3,
    'Very Negative': 2,
    'Overwhelmingly Negative': 1,
  };
  const reviewScore = reviewScoreDescription ? reviewScoreMap[reviewScoreDescription] : null;
  const headerImageElement: HTMLImageElement | null = dom.window.document.querySelector('.game_header_image_full');
  const headerImage = headerImageElement?.src || null;

  return {
    title,
    description,
    metacriticUrl,
    genres,
    releaseDate,
    reviewScore,
    reviewScoreDescription,
    reviewScoreTooltip,
    headerImage,
    updated: new Date().toISOString(),
  };
};

const fetchMetacriticData = async (metacriticUrl: string): Promise<MetacriticData | null> => {
  const metacriticResponse = await fetch(metacriticUrl);
  if (!metacriticResponse.ok) {
    console.error('Error fetching Metacritic page', metacriticUrl);
    return null;
  }
  const metacriticPage = await metacriticResponse.text();
  const dom = new JSDOM(metacriticPage);

  const titleElement: HTMLElement | null = dom.window.document.querySelector('h1');
  const title = titleElement?.textContent?.trim() || null;
  const metacriticMustPlayElement: HTMLElement | null = dom.window.document.querySelector('.c-productScoreInfo_must');
  const mustPlay = metacriticMustPlayElement !== null;
  const metacriticScoreElement: HTMLElement | null = dom.window.document.querySelector('.c-productScoreInfo_scoreNumber');
  const metacriticScore = metacriticScoreElement?.textContent && parseInt(metacriticScoreElement.textContent, 10) || null;

  const platformElements: HTMLElement[] = Array.from(dom.window.document.querySelectorAll('.c-gameDetails_Platforms .c-gameDetails_listItem'));
  const platforms = platformElements.map((platformElement) => platformElement?.textContent?.trim() || '').filter(Boolean);
  const releaseDateElement: HTMLElement | null = dom.window.document.querySelector('.c-gameDetails_ReleaseDate');
  const releaseDateMatch = releaseDateElement?.textContent?.trim().match(/Initial Release Date:\s*(\w+ \d+, \d+)/);
  const releaseDate = releaseDateMatch ? new Date(releaseDateMatch[1]).toISOString() : null;
  const publisherElement: HTMLElement | null = dom.window.document.querySelector('.c-gameDetails_Distributor');
  const publisher = publisherElement?.textContent?.replace(/Publisher:/, '').trim() || null;
  const developerElements: HTMLElement[] = Array.from(dom.window.document.querySelectorAll('.c-gameDetails_Developer .c-gameDetails_listItem'));
  const developers = developerElements.map((devElement) => devElement?.textContent?.trim() || '').filter(Boolean);
  const genresElements: HTMLElement[] = Array.from(dom.window.document.querySelectorAll('.c-genreList_item'));
  const genres: string[] = genresElements.map((genreElement) => genreElement?.textContent?.trim() || '').filter(Boolean);

  return {
    title,
    metacriticScore,
    mustPlay,
    platforms,
    releaseDate,
    developers,
    publisher,
    genres,
    updated: new Date().toISOString(),
  };
};

export { fetchOpenCriticData, fetchSteamData, fetchMetacriticData };
export type { OpenCriricData, SteamData, MetacriticData };