import { ReactNode } from 'react';
import { Game } from '../lib/schema';
import FontAwesomeIcon from './FontAwesomeIcon';

const RatingIndicator = ({ game }: { game: Game | null }): ReactNode => {
  if (game?.rating !== undefined) {
    switch (game.rating) {
      case -1:
        return <FontAwesomeIcon icon={['fas', 'thumbs-down']} className="rating-icon" title="Disliked" />;
      case 0:
        return <span className="rating-icon" title="Neutral">&bull;</span>;
      case 1:
        return <FontAwesomeIcon icon={['fas', 'thumbs-up']} className="rating-icon" title="Liked" />;
      case 2:
        return <FontAwesomeIcon icon={['fas', 'heart']} className="rating-icon" title="Loved" />;
      default:
        return null;
    }
  };
};

export default RatingIndicator;