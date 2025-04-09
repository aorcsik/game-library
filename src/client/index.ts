import { calculateTimeDifference } from '../common/tools.js';

document.addEventListener('DOMContentLoaded', () => {
  const onLoad = async (): Promise<void> => {
    const svgTextCache: Record<string, string> = {};

    const fetchSvgText = async (src: string): Promise<string> => {
      if (svgTextCache[src]) {
        // console.log("from cache", src);
        return svgTextCache[src];
      }
      const response = await fetch(src);
      if (!response.ok) {
        throw new Error(`Failed to load SVG: ${src}`);
      }
      const svgText = await response.text();
      svgTextCache[src] = svgText;
      // console.log("fetched", src);
      return svgText;
    };

    const replaceSvgImage = (img: HTMLImageElement): HTMLElement | null => {
      if (!img.src.match(/(amazon|appstore|epic|gog|playstation|steam|switch)-logo/)) return img;

      const svgText = svgTextCache[img.src];

      // Parse the SVG text and get the SVG element
      const parser = new DOMParser();
      const svgElement = parser.parseFromString(svgText, 'image/svg+xml').documentElement;

      // Copy attributes from the <img> to the <svg>
      if (img.id) svgElement.id = img.id;
      if (img.className) svgElement.setAttribute('class', img.className);
      if (img.alt) svgElement.setAttribute('aria-label', img.alt);

      // Replace the <img> with the inlined <svg>
      img.replaceWith(svgElement);
      return svgElement;
    };

    type FormFields = {
      q: HTMLInputElement;
      layout: RadioNodeList;
      tier: RadioNodeList;
      sort_by: HTMLSelectElement;
      direction: RadioNodeList; 
    };

    const formFields: (keyof FormFields)[] = ['q', 'layout', 'tier', 'sort_by', 'direction'];

    type GameLibraryHeaderForm = HTMLFormElement & FormFields;

    const form = document.getElementById('game_form') as GameLibraryHeaderForm | null;
    if (!form) {
      throw new Error('Form not found');
    }

    type GameGridHeaderCell = HTMLElement & {
      dataset: {
        gamePlatform: string;
      };
    };

    type GameGridRow = HTMLElement & {
      dataset: {
        gameReleaseDate: string;
        openCriticScore: number;
        openCriticCritics: number;
        openCriticTier: string;
        steamReviewScore: number;
        metacriticScore: number;
      };
    };

    const handleFilter = (): void => {

      const words = form.q.value.toLowerCase().trim().replace(/\s+/g, ' ').split(' ').filter(word => word.length > 0);
      const tier = form.tier.value;
      let gameCounter = 0;
      const platformCounter: Record<string, number> = {};
      const gameGridHeaderCells: GameGridHeaderCell[] = Array.from(document.querySelectorAll('.game-header-cell'));
      gameGridHeaderCells.map(cell => cell.dataset.gamePlatform).filter(platform => platform).forEach(platform => {
        platformCounter[platform] = 0;
      });

      const gameGridRows: GameGridRow[] = Array.from(document.querySelectorAll('.game-row'));
      gameGridRows
        .sort((a, b) => {
          return a.id.localeCompare(b.id);
        })
        .sort((a, b) => {
          const reverse = form.direction.value === 'desc' ? -1 : 1;

          if (form.sort_by.value === 'title') {
            return reverse * a.id.localeCompare(b.id);
          }
          if (form.sort_by.value === 'release_date') {
            return reverse * calculateTimeDifference(new Date(b.dataset.gameReleaseDate), new Date(a.dataset.gameReleaseDate));
          }
          if (form.sort_by.value === 'open_critic_score') {
            if (a.dataset.openCriticScore === b.dataset.openCriticScore) {
              return reverse * (a.dataset.openCriticCritics - b.dataset.openCriticCritics);
            }
            return reverse * (a.dataset.openCriticScore - b.dataset.openCriticScore);
          }
          if (form.sort_by.value === 'open_critic_recommendation') {
            if (a.dataset.openCriticCritics === b.dataset.openCriticCritics) {
              return reverse * (a.dataset.openCriticScore - b.dataset.openCriticScore);
            }
            return reverse * (a.dataset.openCriticCritics - b.dataset.openCriticCritics);
          }
          if (form.sort_by.value === 'steam_reviews') {
            return reverse * (a.dataset.steamReviewScore - b.dataset.steamReviewScore);
          }
          if (form.sort_by.value === 'metascore') {
            return reverse * (a.dataset.metacriticScore - b.dataset.metacriticScore);
          }
          return 0;
        })
        .forEach(row => {
        row.className = 'game-row hidden';

        const matchSearchTerm = words.reduce((match, word) => match && !!row.id.match(new RegExp(word)), true);
        const matchTierFilter = !tier || (row.dataset.openCriticTier ? row.dataset.openCriticTier.toLowerCase().match(new RegExp(tier)) : false);
        if (matchSearchTerm && matchTierFilter) {
          row.className = 'game-row';
          
          gameCounter++;
          Object.keys(platformCounter).forEach(platform => {
            if (row.querySelector(`.game-${platform}:not(.game-placeholder)`)) platformCounter[platform]++;
          });
        }

        row.parentNode?.appendChild(row);
      });

      const gameCounterElement: HTMLElement | null = document.querySelector('.game-count');
      if (gameCounterElement) {
        gameCounterElement.innerHTML = `${gameCounter}`;
      }
      Object.keys(platformCounter).forEach(platform => {
        const platformCounterElement: HTMLElement | null = document.querySelector(`.platform-${platform} .platform-count`);
        if (platformCounterElement) {
          platformCounterElement.innerHTML = `${platformCounter[platform]}`;
        }
      });
    };

    const handleFormChange = (): void => {
      const url = new URL(document.location.href);
      formFields.forEach(field => {
        if (!form[field].value) {
          url.searchParams.delete(field);
          return;
        }
        url.searchParams.set(field, form[field].value);
      });
      window.history.pushState(null, '', url.toString());
      handleFilter();
    };

    const handlePageLoad = (): void => {
      const url = new URL(document.location.href);
      formFields.forEach(field => {
        if (!url.searchParams.has(field)) return;
        form[field].value = url.searchParams.get(field) || '';
      });
      if (document.documentElement.clientWidth <= 600) {
        // form.layout.value = "games";
      }
      handleFilter();
    };

    form.addEventListener('change', () => {
      handleFormChange();
    });

    form.addEventListener('submit', event => {
      event.preventDefault();
      handleFormChange();
      return false;
    });

    let searchDebounce: number | null = null;
    form.q.addEventListener('keyup', () => {
      if (searchDebounce) window.clearTimeout(searchDebounce);
      searchDebounce = window.setTimeout(() => {
        handleFormChange();
      }, 500);
    });

    form.q.addEventListener('invalid', event => {
      event.preventDefault();
    });

    const searchCancelButton: HTMLButtonElement | null = form.q.parentNode?.querySelector('.cancel-button') || null;
    searchCancelButton?.addEventListener('click', () => {
      form.q.value = '';
      handleFormChange();
    });

    window.addEventListener('popstate', () => {
      handlePageLoad();
    });

    handlePageLoad();

    // Select all <img> tags with the "icon" class
    const svgImages: HTMLImageElement[] = Array.from(document.querySelectorAll('img.game-platform'));

    await Promise.all(svgImages.reduce((svgs: string[], img) => {
      if (!svgs.includes(img.src)) svgs.push(img.src);
      return svgs;
    }, []).map(src => fetchSvgText(src)));

    [...svgImages].forEach(img => replaceSvgImage(img));
  };

  onLoad().catch((error: Error) => {
    console.error('Error loading page:', error);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.innerHTML = `<p>Error loading page: ${error.message}</p>`;
    document.body.appendChild(errorDiv);
  });
});