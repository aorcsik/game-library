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

const fetchMetacriticData = async (metacriticUrl: string): Promise<MetacriticData> => {
  const metacriticResponse = await fetch(metacriticUrl);
  if (!metacriticResponse.ok) {
    console.error('Error fetching Metacritic page', metacriticUrl);
    throw new Error('Error fetching Metacritic page');
  }
  const metacriticPage = await metacriticResponse.text();
  const dom = new JSDOM(metacriticPage);

  const titleElement: HTMLElement | null = dom.window.document.querySelector('h1');
  const title = titleElement?.textContent?.trim() || null;

  if (!title) {
    console.error('Error parsing Metacritic page, title not found', metacriticUrl);
    throw new Error('Error parsing Metacritic page, title not found');
  }

  const metacriticMustPlayElement: HTMLImageElement | null = dom.window.document.querySelector('[data-testid="global-score-badge"] img');
  const mustPlay = !!metacriticMustPlayElement?.src.includes("must-play");
  const metacriticScoreElement: HTMLElement | null = dom.window.document.querySelector('[data-testid="global-score"]');
  const metacriticScoreValue = metacriticScoreElement?.textContent?.trim() || null;

  if (metacriticScoreValue === null) {
    console.error('Error parsing Metacritic page, score not found', metacriticUrl);
    throw new Error('Error parsing Metacritic page, score not found');
  }

  const metacriticScore = metacriticScoreValue === 'tbd' ? -1 : parseInt(metacriticScoreValue, 10);

  let releaseDate: string | null = null;
  const platforms: string[] = [];
  const publishers: string[] = [];
  const developers: string[] = [];
  const genres: string[] = [];
  Array.from(dom.window.document.querySelectorAll('.c-product-details__section')).map((section) => {
    const sectionLabel = section.querySelector(".c-product-details__section__label")?.textContent?.trim();
    if (sectionLabel === "Initial Release Date:") {
      const releaseDateMatch = section.textContent?.trim().match(/Initial Release Date:\s*(\w+ \d+, \d+)/);
      if (releaseDateMatch) {
        releaseDate = new Date(releaseDateMatch[1]).toISOString();
      }
    }
    if (sectionLabel === "Platforms:") {
      section.querySelectorAll(".c-product-details__section__list-item").forEach((platformElement) => {
        const platform = platformElement.textContent?.trim();
        if (platform) {
          platforms.push(platform);
        }
      });
    }
    if (sectionLabel === "Publisher:") {
      section.querySelectorAll(".c-product-details__section__list-item").forEach((publisherElement) => {
        const publisher = publisherElement.textContent?.trim();
        if (publisher) {
          publishers.push(publisher);
        }
      });
    }
    if (sectionLabel === "Developer:") {
      section.querySelectorAll(".c-product-details__section__list-item").forEach((devElement) => {
        const developer = devElement.textContent?.trim();
        if (developer) {
          developers.push(developer);
        }
      });
    }
    if (sectionLabel === "Genres:") {
      Array.from(section.querySelectorAll('.c-genreList_item')).forEach((genreElement) => {
        const genre = genreElement.textContent?.trim();
        if (genre) {
          genres.push(genre);
        }
      });
    }
  });

  return {
    title,
    metacriticScore,
    mustPlay,
    platforms,
    releaseDate,
    developers,
    publisher: publishers.join(', '),
    genres,
    updated: new Date().toISOString(),
  };
};

export { fetchOpenCriticData, fetchSteamData, fetchMetacriticData };
export type { OpenCriricData, SteamData, MetacriticData };