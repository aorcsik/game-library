'use client';

import Head from 'next/head';
import { Platform, PlatformList, PurchasedGame } from '../lib/PurchaseService';
import GameLibraryControllerIcon from '../../public/game-library-controller.svg';
import { useState, useEffect, useCallback, useRef } from 'react';

import GameGrid from '../components/GameGrid';
import GameGridHeader from '../components/GameGridHeader';
import SortControl from '../components/SortControl';
import SearchControl from '../components/SearchControl';
import FontAwesomeIcon from './FontAwesomeIcon';
import { getReleaseDate } from './GameRowTitle';


type GameLibraryProps = {
  purchasedGames: PurchasedGame[];
  platforms: PlatformList;
};

type SortByType = 'gameTitle' | 'gameReleaseDate' | 'openCriticScore' | 'openCriticCritics' | 'steamReviewScore' | 'metacriticScore';
type SortDirection = 'asc' | 'desc';

const sortByFieldName = 'sort_by';
const sortDirectionFieldName = 'direction';
const searchFieldName = 'q';

export default function GameLibrary({ purchasedGames, platforms: initialPlatforms }: GameLibraryProps): React.JSX.Element {  
  const [sortBy, setSortBy] = useState<SortByType>('gameTitle');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [gameCount, setGameCount] = useState(purchasedGames.length);
  const [platforms, setPlatforms] = useState(initialPlatforms);

  // Create a ref for the game grid container for direct DOM manipulation
  const gameGridRef = useRef<HTMLDivElement>(null);
  
  // Set up debounced search query
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms is usually a good balance

    return (): void => clearTimeout(timerId);
  }, [searchQuery]);

  // Now use debouncedSearchQuery for the expensive filtering operation
  useEffect(() => {
    if (!gameGridRef.current) return;
    
    requestAnimationFrame(() => {
      if (!gameGridRef.current) return;

      let filteredGameCount = 0;
      const filteredPlatforms = { ...initialPlatforms };
      const gameGridHeaderCells = Array.from(gameGridRef.current.querySelectorAll('.game-header-cell'));
      gameGridHeaderCells.forEach(cell => {
        const platform = (cell as HTMLElement).dataset.gamePlatform as Platform;
        if (platform && filteredPlatforms[platform]) {
          filteredPlatforms[platform].count = 0;
        }
      });

      const gameItems = gameGridRef.current?.querySelectorAll('.game-row');
      if (!gameItems || gameItems.length === 0) return;
      
      // Convert NodeList to Array for sorting
      const gameItemsArray = Array.from(gameItems);
      
      // Apply search filtering first (just hide/show with CSS)
      gameItemsArray.forEach(item => {
        const gameTitle = item.id.toLowerCase() || '';
        if (!debouncedSearchQuery || gameTitle.includes(debouncedSearchQuery.toLowerCase())) {
          item.classList.remove('hidden');
          filteredGameCount++;
          Object.keys(filteredPlatforms).forEach((platform: Platform) => {
            if (item.querySelector(`.game-${platform}:not(.game-placeholder)`)) filteredPlatforms[platform].count++;
          });
        } else {
          item.classList.add('hidden');
        }
      });

      setGameCount(filteredGameCount);
      setPlatforms(filteredPlatforms);
    });

  }, [debouncedSearchQuery, purchasedGames, initialPlatforms]); 

  const getGameDataSetByKey = useCallback((gameKey: string) => {
    const gameDataSet: Record<string, string> = {};
    const game = purchasedGames.find(g => g.key === gameKey);
    if (game) {
      gameDataSet.gameTitle = game.key;
      gameDataSet.gameReleaseDate = (new Date(getReleaseDate(game) || '1970-01-01')).getTime().toString();
      gameDataSet.openCriticTier = game.openCriticData?.tier ? game.openCriticData.tier.toString() : 'n-a';
      gameDataSet.openCriticScore = game.openCriticData?.score ? game.openCriticData.score.toString() : ''; 
      gameDataSet.openCriticCritics = game.openCriticData?.critics ? game.openCriticData.critics.toString() : '';
      gameDataSet.steamReviewScore = game.steamData?.reviewScore ? game.steamData.reviewScore.toString() : '';
      gameDataSet.metacriticScore = game.metacriticData?.metacriticScore ? game.metacriticData.metacriticScore.toString() : '';
    }
    return gameDataSet;
  }, [purchasedGames]);

  useEffect(() => {
    if (!gameGridRef.current) return;
    
    requestAnimationFrame(() => {
      if (!gameGridRef.current) return;

      const gameItems = gameGridRef.current?.querySelectorAll('.game-row');
      if (!gameItems || gameItems.length === 0) return;
      
      // Convert NodeList to Array for sorting
      const gameItemsArray = Array.from(gameItems);

        gameItemsArray.sort((a, b) => {
          const aValue = getGameDataSetByKey(a.id)[sortBy] || '';
          const bValue = getGameDataSetByKey(b.id)[sortBy] || '';

          if (sortBy === 'gameTitle') {
            return aValue.localeCompare(bValue, undefined, { numeric: true });
          }
          const aNum = parseInt(aValue, 10);
          const bNum = parseInt(bValue, 10);
          if (isNaN(aNum) || isNaN(bNum)) {
            return 0;
          }
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }).forEach(item => {
          item.parentNode.appendChild(item);
        });
      });
  }, [sortBy, sortDirection, getGameDataSetByKey]);

  const updateQueryParams = useCallback((key: string, value: string) => {
    const searchParams = new URLSearchParams(window.location.search);
    if ([sortByFieldName, sortDirectionFieldName, searchFieldName].includes(key)) {
      if (value === '') {
        searchParams.delete(key);
      } else {
        searchParams.set(key, value);
      }
    }
    window.history.replaceState({}, '', `${window.location.pathname}?${searchParams}`);
  }, []);

  const handleDirectionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedValue = e.target.value as SortDirection;
    setSortDirection(selectedValue);
    updateQueryParams(sortDirectionFieldName, selectedValue);
  }, [updateQueryParams]);
  const handleSortByChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value as SortByType;
    setSortBy(selectedValue);
    updateQueryParams(sortByFieldName, selectedValue);
  }, [updateQueryParams]);
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const searchValue = e.target.value;
    setSearchQuery(searchValue);
    updateQueryParams(searchFieldName, searchValue);
  }, [updateQueryParams]);
  const handleClearSearch = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setSearchQuery('');
    updateQueryParams(searchFieldName, '');
  }, [updateQueryParams]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const sortByParam = searchParams.get(sortByFieldName) as SortByType;
    const sortDirectionParam = searchParams.get(sortDirectionFieldName) as SortDirection;
    const searchQueryParam = searchParams.get(searchFieldName) || '';
    if (sortByParam && ['gameTitle', 'gameReleaseDate', 'openCriticScore', 'openCriticCritics', 'steamReviewScore', 'metacriticScore'].includes(sortByParam)) {
      setSortBy(sortByParam);
    }
    if (sortDirectionParam && ['asc', 'desc'].includes(sortDirectionParam)) {
      setSortDirection(sortDirectionParam);
    }
    if (searchQueryParam) {
      setSearchQuery(searchQueryParam);
    }
  }, []);

  return (
    <>
      <Head>
        <title>{`${gameCount} | Game Library`}</title>
      </Head>

      <input className="hidden-checkbox" type="checkbox" id="toggle-controls" />
      <header>
        <div className="container">
          <div className="controls">
            <h1>
              <GameLibraryControllerIcon className="logo" />
              <strong>Game Library</strong>
              <span className="game-count">{gameCount}</span>
            </h1>
            <label className="button mobile-menu-open" htmlFor="toggle-controls">
              <FontAwesomeIcon icon={['far', 'bars']} />
            </label>
            <label className="button mobile-menu-close" htmlFor="toggle-controls">
              <FontAwesomeIcon icon={['far', 'xmark']} />
            </label>
            <SortControl 
              sortBy={sortBy}
              sortDirection={sortDirection}
              handleSortByChange={handleSortByChange}
              handleDirectionChange={handleDirectionChange}
              sortByFieldName={sortByFieldName}
              sortDirectionFieldName={sortDirectionFieldName}
            />
            <SearchControl
              searchQuery={searchQuery}
              handleSearch={handleSearch}
              handleClearSearch={handleClearSearch}
              searchFieldName={searchFieldName}
            />
          </div>
        </div>
      </header>

      <div className="main">
        <div className="container">
          <div className="game-grid" ref={gameGridRef}>
            <GameGridHeader platforms={platforms} />
            <GameGrid purchasedGames={purchasedGames} platforms={initialPlatforms} />
          </div>
        </div>
      </div>

      <footer>
        <GameLibraryControllerIcon className="logo" />
        <span>
          Game Library is made with <FontAwesomeIcon icon={['fas', 'heart']} /> by 
          <a href="https://aorcsik.com/" target="_blank" rel="noopener noreferrer">Antal Orcsik</a>.
        </span>
      </footer>
    </>
  );
}