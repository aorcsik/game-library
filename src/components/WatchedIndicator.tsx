import { JSX } from 'react';
import { Game } from '../lib/schema';
import FontAwesomeIcon from './FontAwesomeIcon';

const WatchedIndicator = ({ game }: { game: Game | null }): JSX.Element => {
  if (game.watched) {
    return <FontAwesomeIcon icon={['fas', 'eye']} className="rating-icon" title="Watched" />;
  }
  return null;
};

export default WatchedIndicator;