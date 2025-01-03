// Steam
// API Key from https://steamcommunity.com/dev/apikey
// API Docs: https://developer.valvesoftware.com/wiki/Steam_Web_API#GetOwnedGames_(v0001)
// https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=7A3F672ACCA3D06733AB8A992CB5CB34&steamid=76561197997887483&include_appinfo=1&format=json

// Epic Game Store
// ~/Library/Application\ Support/heroic/store_cache/legendary_library.json

// Amazon Gaming
// ~/Library/Application\ Support/heroic/store_cache/nile_library.json

// GOG
// ~/Library/Application\ Support/heroic/store_cache/gog_library.json
// or
// https://www.gog.com/en/account
[...document.querySelectorAll(".product-title__text")].map(el => el.innerText);

// Nintendo
// https://www.nintendo.com/us/orders/
// [...document.querySelectorAll(".cjjdxs")].map(el => el.innerText);

// PlayStation
// https://library.playstation.com/recently-purchased
JSON.stringify([...document.querySelectorAll("a[data-qa='collection-game-list-product#store-link']")].map(el => {
  const data = JSON.parse(el.getAttribute("data-telemetry-meta"));
  data.cover = el.querySelector("img[data-qa='collection-game-list-product#game-art#image#image']").src;
  return data;
}));
