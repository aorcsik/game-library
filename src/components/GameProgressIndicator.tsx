'use client';

import { JSX } from 'react';
import { CircularProgressbarWithChildren } from 'react-circular-progressbar';
import FontAwesomeIcon from './FontAwesomeIcon';
import { Game } from '../lib/schema';

const GameProgressIndicator = ({ game }: { game: Game | null; }): JSX.Element => {

  let progressStatus = '';
  if (game?.progress === 100) {
    progressStatus = 'game-completed';
  } else if (game?.completed) {
    progressStatus = 'game-completed-story';
  }

  return game?.progress > -1 || game?.completed ? <div className={`progress-indicator ${progressStatus}`}>
    <CircularProgressbarWithChildren value={game.progress > -1 ? game.progress : 0} background={true} backgroundPadding={6} strokeWidth={6}>
      <div className="progress-value">
        {game.completed && game.progress === -1 && <FontAwesomeIcon icon={['fas', 'check']} aria-label="Completed" />}
        {!game.completed && game.progress === 0 && <FontAwesomeIcon icon={['fas', 'question']} aria-label="?" />}
        {game.progress > 0 && (game.progress === 100 ? <FontAwesomeIcon icon={['fas', 'crown']} aria-label="100%" /> : game.progress)}
      </div>
    </CircularProgressbarWithChildren>
  </div> : null;
};

export default GameProgressIndicator;