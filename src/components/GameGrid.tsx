import { PlatformList, PurchasedGame } from '../lib/PurchaseService';
import GameRow from './GameRow';
import { memo, ReactNode } from 'react';


interface GameGridProps {
  purchasedGames: PurchasedGame[];
  platforms: PlatformList;
  onOpenToggle: (gameKey: string) => void;
}

const GameGrid = ({ purchasedGames, platforms, onOpenToggle }: GameGridProps): ReactNode => {
  const sortedGames = [...purchasedGames].sort((a, b) => {
    return a.key.localeCompare(b.key, undefined, { numeric: true });
  });

  return sortedGames.map(game => {
    return <GameRow game={game} key={game.key} platforms={platforms} onOpenToggle={onOpenToggle} />;
  });
};

export default memo(GameGrid);
