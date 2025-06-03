import { PlatformList, PurchasedGame } from '../lib/PurchaseService';
import GameRow from './GameRow';
import { memo, ReactNode } from 'react';


interface GameGridProps {
  purchasedGames: PurchasedGame[];
  platforms: PlatformList;
}

const GameGrid = ({ purchasedGames, platforms }: GameGridProps): ReactNode => {
  const sortedGames = [...purchasedGames].sort((a, b) => {
    return a.key.localeCompare(b.key, undefined, { numeric: true });
  });

  return sortedGames.map(game => {
    return <GameRow game={game} key={game.key} platforms={platforms} />;
  });
};

export default memo(GameGrid);
