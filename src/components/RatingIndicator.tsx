import { JSX } from 'react';
import { Game } from '../lib/schema';
import FontAwesomeIcon from './FontAwesomeIcon';

const RatingIndicator = ({ game }: { game: Game | null }): JSX.Element => {
  if (game.rating !== undefined) {
    switch (game.rating) {
      case -10:
        return <FontAwesomeIcon icon={['fas', 'eye']} className="rating-icon" title="Watched" />;
        break;
      case -1:
        return <FontAwesomeIcon icon={['fas', 'thumbs-down']} className="rating-icon" title="Disliked" />;
        break;
      case 0:
        return <span className="rating-icon" title="Neutral">&bull;</span>;
        break;
      case 1:
        return <FontAwesomeIcon icon={['fas', 'thumbs-up']} className="rating-icon" title="Liked" />;
        break;
      case 2:
        return <FontAwesomeIcon icon={['fas', 'heart']} className="rating-icon" title="Loved" />;
        break;
      default:
        return null;
    }
  };
};

export default RatingIndicator;