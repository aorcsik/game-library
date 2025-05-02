import { library } from '@fortawesome/fontawesome-svg-core';
import { faHeart as fasHeart, faSquareHeart as fasSquareHeart, faSquareCheck as fasSquareCheck } from '@fortawesome/pro-solid-svg-icons';
import { faHeart, faBars, faXmark, faArrowDownAZ, faArrowUpZA, faMagnifyingGlass, faHandPointRight, faSquareEllipsis, faSquare, faArrowDown19, faArrowUp91 } from '@fortawesome/pro-regular-svg-icons';

// Add icons to library
library.add(
  fasHeart, fasSquareHeart, fasSquareCheck,
  faHeart, faBars, faXmark, faArrowDownAZ, faArrowUpZA, faMagnifyingGlass, faHandPointRight, faSquareEllipsis, faSquare, faArrowDown19, faArrowUp91
);

// Export the icons for direct access
export const icons = {
  solid: {
    heart: fasHeart,
    squareHeart: fasSquareHeart,
    squareCheck: fasSquareCheck,
  },
  regular: {
    heart: faHeart,
    bars: faBars,
    xmark: faXmark,
    arrowDownAZ: faArrowDownAZ,
    arrowUpZA: faArrowUpZA,
    magnifyingGlass: faMagnifyingGlass,
    handPointRight: faHandPointRight,
    squareEllipsis: faSquareEllipsis,
    square: faSquare,
    arrowDown19: faArrowDown19,
    arrowUp91: faArrowUp91,
  }
};