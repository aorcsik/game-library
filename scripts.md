## Steam

### API

API Key from https://steamcommunity.com/dev/apikey
API Docs: https://developer.valvesoftware.com/wiki/Steam_Web_API#GetOwnedGames_(v0001)
Owned Games: https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={STEAM_API_KEY}&steamid={STEAM_ID}&include_appinfo=1&format=json
Wishlist: https://api.steampowered.com/IWishlistService/GetWishlist/v1/?key={STEAM_API_KEY}&steamid={STEAM_ID}&format=json
App Reviews: https://store.steampowered.com/appreviews/730?json=1
App Details: https://store.steampowered.com/api/appdetails?appids=730

### Store Page

Store page URL:

Handling age restrictions:

## Epic Game Store
```
~/Library/Application\ Support/heroic/store_cache/legendary_library.json
```

## Amazon Gaming
```
~/Library/Application\ Support/heroic/store_cache/nile_library.json
```

## GOG
```
~/Library/Application\ Support/heroic/store_cache/gog_library.json
```
or
https://www.gog.com/en/account
```javascript
[...document.querySelectorAll(".product-title__text")].map(el => el.innerText);
```

## Nintendo Switch
https://ec.nintendo.com/my
https://www.nintendo.com/us/orders/
https://accounts.nintendo.com/portal/vgcs
```javascript
console.log(JSON.stringify(Array.from(document.querySelectorAll("#vgcList ul.vgcsVgcList_list li.vgcsVgcList_listItem a")).map((vgc) => {
  const vgcThumb = vgc.querySelector("img.virtualGameCard_thumb");
  return {
      id: vgc.href.match(/vgc_id=(.*)/)[1],
      title: vgcThumb.alt,
      cover: vgcThumb.src
  };
})).replace('[{', '[\n  {').replace(/\},\{/g, '},\n  {').replace('}]', '}\n]'));
```

## PlayStation
https://library.playstation.com/recently-purchased
```javascript
console.log(JSON.stringify([...document.querySelectorAll("a[data-qa='collection-game-list-product#store-link']")].map(el => {
  const data = JSON.parse(el.getAttribute("data-telemetry-meta"));
  delete(data.conceptId);
  delete(data.titleId);
  data.serviceUpsell = el.querySelector(".psw-service-upsell") ? el.querySelector(".psw-service-upsell").innerText : null;
  data.platform = el.querySelector(".psw-platform-tag").innerText;
  data.cover = el.querySelector("img[data-qa='collection-game-list-product#game-art#image#image']").src;
  return data;
})).replace('[{', '[\n  {').replace(/\},\{/g, '},\n  {').replace('}]', '}\n]'));
```

## Xbox
https://account.microsoft.com/billing/orders