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

  // Select all <img> tags with the "icon" class
  const svgImages = document.querySelectorAll("img.game-platform");

  await Promise.all([...svgImages].reduce((svgs, img) => {
    if (!svgs.includes(img.src)) svgs.push(img.src);
    return svgs;
  }, []).map(src => fetchSvgText(src)));

  await Promise.all([...svgImages].map(img => replaceSvgImage(img)));

  const gamesHeader = document.querySelector(".games-header");
  const gameRowTitle = document.createElement("div");
  gameRowTitle.className = "game-row-title"
  gamesHeader.insertBefore(gameRowTitle, gamesHeader.firstChild);

  document.querySelectorAll(".game-row").forEach(row => {
    const gameRowTitle = document.createElement("div");
    gameRowTitle.className = "game-row-title"
    gameRowTitle.innerHTML = row.querySelector(".game-cell .game-title").innerHTML;
    row.insertBefore(gameRowTitle, row.firstChild);
  });

  const form = document.getElementById("game_form");
  let url = new URL(document.location);
  form.q.value = url.searchParams.get("q");
  form.layout.value = url.searchParams.get("layout");

  const handleSearch = () => {
    const words = form.q.value.toLowerCase().trim().replaceAll(/\s+/g, " ").split(" ").filter(word => word.length > 0);
    [...document.querySelectorAll(".game-row")].forEach(row => {
      row.className = row.className.replace(/game-row hidden/, "game-row");
      if (!words.reduce((match, word) => match && !!row.id.match(new RegExp(word)), true)) {
        row.className = row.className.replace(/game-row/, "game-row hidden");
      }
    });
  };

  handleSearch();

  const handleFormChange = () => {
    url.searchParams.set("q", form.q.value);
    url.searchParams.set("layout", form.layout.value);
    window.history.pushState(null, '', url.toString());
    handleSearch();
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
  document.getElementById("q").addEventListener("keyup", event => {
    if (searchDebounce) window.clearTimeout(searchDebounce);
    searchDebounce = window.setTimeout(() => {
      handleFormChange();
    }, 500);
  });
});