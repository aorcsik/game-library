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

  const replaceSvgImage = async img => {
    const svgText = await fetchSvgText(img.src);

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

  const gamesHeader = document.querySelector(".games-header");
  const gameRowTitle = document.createElement("div");
  gameRowTitle.className = "game-row-title"
  gamesHeader.insertBefore(gameRowTitle, gamesHeader.firstChild);

  document.querySelectorAll(".game-row").forEach(row => {
    const gameRowTitle = document.createElement("a");
    gameRowTitle.className = "game-row-title"

    const openCriticTier = row.dataset.openCriticTier ? row.dataset.openCriticTier : "";
    const openCriticTierClass = openCriticTier ? "tier-" + openCriticTier.toLowerCase().replace(/\s+/g, "-") : "";
    const openCriticScore = row.dataset.openCriticScore ? row.dataset.openCriticScore : "";
    const openCriticCritics = row.dataset.openCriticCritics ? `${row.dataset.openCriticCritics}%` : "";
    const openCriticUrl = row.dataset.openCriticId ? `https://opencritic.com/game/${row.dataset.openCriticId}` : "";
    const releaseDate = row.dataset.gameReleaseDate ? new Date(row.dataset.gameReleaseDate) : null;
    gameRowTitle.href = openCriticUrl
    gameRowTitle.target = "_blank";
    gameRowTitle.innerHTML = 
      `<span class="open-critic-tier ${openCriticTierClass}" title="${openCriticTier}">${openCriticTier}</span>` +
      `<span class="open-critic-score ${openCriticTierClass}">${openCriticScore}</span>` +
      `<span class="open-critic-critics ${openCriticTierClass}">${openCriticCritics}</span>` +
      `<span class="game-title">
        ${row.dataset.gameTitle}
        <span class="release-date">${releaseDate ? `(${releaseDate.getFullYear()})` : ""}</span>
      </span>`;
    row.insertBefore(gameRowTitle, row.firstChild);
  });

  const form = document.getElementById("game_form");
  let url = new URL(document.location);
  form.q.value = url.searchParams.get("q");
  form.layout.value = url.searchParams.get("layout");

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

    [...document.querySelectorAll(".game-row")].forEach(row => {
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
    });

    document.querySelector(".game-count").innerHTML = gameCounter;
    Object.keys(platformCounter).forEach(platform => {
      console.log(`.platform-${platform} .platform-count`, platformCounter[platform]);
      document.querySelector(`.platform-${platform} .platform-count`).innerHTML = platformCounter[platform];
    });
  };

  handleFilter();

  const handleFormChange = () => {
    url.searchParams.set("q", form.q.value);
    url.searchParams.set("layout", form.layout.value);
    window.history.pushState(null, '', url.toString());
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

  // Select all <img> tags with the "icon" class
  const svgImages = document.querySelectorAll("img.game-platform");

  document.querySelector(".game-count").innerHTML = document.querySelectorAll(".game-row").length;

  await Promise.all([...svgImages].reduce((svgs, img) => {
    if (!svgs.includes(img.src)) svgs.push(img.src);
    return svgs;
  }, []).map(src => fetchSvgText(src)));

  await Promise.all([...svgImages].map(img => replaceSvgImage(img)));
});