document.addEventListener("DOMContentLoaded", async () => {
  const svgTextCache = {};

  const fetchSvgText = async src => {
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

  const replaceSvgImage = img => {
    if (!img.src.match(/(amazon|appstore|epic|gog|playstation|steam|switch)-logo/)) return;

    const svgText = svgTextCache[img.src];

    // Parse the SVG text and get the SVG element
    const parser = new DOMParser();
    const svgElement = parser.parseFromString(svgText, "image/svg+xml").documentElement;

    // Copy attributes from the <img> to the <svg>
    if (img.id) svgElement.id = img.id;
    if (img.className) svgElement.setAttribute("class", img.className);
    if (img.alt) svgElement.setAttribute("aria-label", img.alt);

    // Replace the <img> with the inlined <svg>
    img.replaceWith(svgElement);
  };

  const formFields = ['q', 'layout', 'tier', 'sort_by', 'direction'];

  const gamesHeader = document.querySelector(".games-header");
  const gameRowTitle = document.createElement("div");
  gameRowTitle.className = "game-row-title"
  gamesHeader.insertBefore(gameRowTitle, gamesHeader.firstChild);

  document.querySelectorAll(".game-row").forEach(row => {
    const gameRowTitle = document.createElement("div");
    gameRowTitle.className = "game-row-title"

    const openCriticTier = row.dataset.openCriticTier ? row.dataset.openCriticTier : "";
    const openCriticTierClass = openCriticTier ? "tier-" + openCriticTier.toLowerCase().replace(/\s+/g, "-") : "";
    const openCriticScore = row.dataset.openCriticScore ? row.dataset.openCriticScore : "";
    const openCriticCritics = row.dataset.openCriticCritics ? `${row.dataset.openCriticCritics}%` : "";
    const openCriticUrl = row.dataset.openCriticId && row.dataset.openCriticId !== "skip" ? `https://opencritic.com/game/${row.dataset.openCriticId}` : "";
    const releaseDate = row.dataset.gameReleaseDate ? new Date(row.dataset.gameReleaseDate) : null;
    
    const openCriticLink = row.dataset.openCriticId && row.dataset.openCriticId !== "skip" ? `<a href="${openCriticUrl}" target="_blank" class="open-critic-link">` +
      `<span class="open-critic-tier ${openCriticTierClass}" title="${openCriticTier}">${openCriticTier}</span>` +
      `<span class="open-critic-score ${openCriticTierClass}">${openCriticScore}</span>` +
      `<span class="open-critic-critics ${openCriticTierClass}">${openCriticCritics}</span>` +
    `</a>` : `<span class="open-critic-link disabled">` +
      `<span class="open-critic-tier ${openCriticTierClass}" title="${openCriticTier}">${openCriticTier}</span>` +
      `<span class="open-critic-score ${openCriticTierClass}">${openCriticScore}</span>` +
      `<span class="open-critic-critics ${openCriticTierClass}">${openCriticCritics}</span>` +
    `</span>`;

    gameRowTitle.innerHTML = 
      openCriticLink +
      `<span class="game-title">
        ${row.dataset.gameTitle}
        <span class="release-date">${releaseDate ? `(${releaseDate.getFullYear()})` : ""}</span>
      </span>`;
    row.insertBefore(gameRowTitle, row.firstChild);
  });

  if (window.innerWidth <= 600) {
    form.layout.value = "games";
  }

  let rowRevealInterval = null;
  const handleFilter = () => {

    if (rowRevealInterval) window.clearInterval(rowRevealInterval);
    const words = form.q.value.toLowerCase().trim().replaceAll(/\s+/g, " ").split(" ").filter(word => word.length > 0);
    const tier = form.tier.value;
    let gameCounter = 0;
    const platformCounter = {};
    [...document.querySelectorAll(".game-header-cell")].map(cell => cell.dataset.gamePlatform).filter(platform => platform).forEach(platform => {
      platformCounter[platform] = 0
    });

    [...document.querySelectorAll(".game-row")]
      .sort((a, b) => {
        return a.id.localeCompare(b.id);
      })
      .sort((a, b) => {
        const reverse = form.direction.value === "desc" ? -1 : 1;

        if (form.sort_by.value === "title") {
          return reverse * a.id.localeCompare(b.id);
        }
        if (form.sort_by.value === "release_date") {
          return reverse * (new Date(a.dataset.gameReleaseDate) - new Date(b.dataset.gameReleaseDate));
        }
        if (form.sort_by.value === "open_critic_score") {
          if (a.dataset.openCriticScore === b.dataset.openCriticScore) {
            return reverse * (a.dataset.openCriticCritics - b.dataset.openCriticCritics);
          }
          return reverse * (a.dataset.openCriticScore - b.dataset.openCriticScore);
        }
        if (form.sort_by.value === "open_critic_recommendation") {
          if (a.dataset.openCriticCritics === b.dataset.openCriticCritics) {
            return reverse * (a.dataset.openCriticScore - b.dataset.openCriticScore);
          }
          return reverse * (a.dataset.openCriticCritics - b.dataset.openCriticCritics);
        }
        return 0;
      })
      .forEach(row => {
      row.className = "game-row hidden";

      const matchSearchTerm = words.reduce((match, word) => match && !!row.id.match(new RegExp(word)), true);
      const matchTierFilter = !tier || (row.dataset.openCriticTier ? row.dataset.openCriticTier.toLowerCase().match(new RegExp(tier)) : false);
      if (matchSearchTerm && matchTierFilter) {
        row.className = "game-row";
        
        gameCounter++;
        Object.keys(platformCounter).forEach(platform => {
          if (row.querySelector(`.game-${platform}:not(.game-placeholder)`)) platformCounter[platform]++;
        });
      }

      row.parentNode.appendChild(row);
    });

    document.querySelector(".game-count").innerHTML = gameCounter;
    Object.keys(platformCounter).forEach(platform => {
      document.querySelector(`.platform-${platform} .platform-count`).innerHTML = platformCounter[platform];
    });
  };

  const handleFormChange = () => {
    let url = new URL(document.location);
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

  const form = document.getElementById("game_form");

  const handlePageLoad = () => {
    let url = new URL(document.location);
    formFields.forEach(field => {
      if (!url.searchParams.has(field)) return;
      form[field].value = url.searchParams.get(field);
    });
    handleFilter();
  };

  form.addEventListener("change", () => {
    handleFormChange();
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    handleFormChange();
    return false;
  });

  let searchDebounce = null;
  form.q.addEventListener("keyup", event => {
    if (searchDebounce) window.clearTimeout(searchDebounce);
    searchDebounce = window.setTimeout(() => {
      handleFormChange();
    }, 500);
  });

  form.q.addEventListener("invalid", event => {
    event.preventDefault();
  });

  form.q.parentNode.querySelector(".cancel-button").addEventListener("click", event => {
    form.q.value = "";
    handleFormChange();
  });

  window.addEventListener("popstate", event => {
    handlePageLoad();
  });

  handlePageLoad();

  // Select all <img> tags with the "icon" class
  const svgImages = document.querySelectorAll("img.game-platform");

  await Promise.all([...svgImages].reduce((svgs, img) => {
    if (!svgs.includes(img.src)) svgs.push(img.src);
    return svgs;
  }, []).map(src => fetchSvgText(src)));

  [...svgImages].forEach(img => replaceSvgImage(img));
});