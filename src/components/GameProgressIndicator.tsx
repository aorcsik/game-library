'use client';

import { ReactNode } from 'react';
import { CircularProgressbarWithChildren } from 'react-circular-progressbar';
import FontAwesomeIcon from './FontAwesomeIcon';
import { Game } from '../lib/schema';

const GameProgressIndicator = ({ game }: { game: Game | null; }): ReactNode => {
  let progressStatus = '';
  if (game?.progress === 100) {
    progressStatus = 'game-completed';
  } else if (game?.completed) {
    progressStatus = 'game-completed-story';
  }

  const gameProgress = game?.progress ?? 0;

  return gameProgress > -1 || game?.completed ? <div className={`progress-indicator ${progressStatus}`}>
    <CircularProgressbarWithChildren value={gameProgress > -1 ? gameProgress : 0} background={true} backgroundPadding={6} strokeWidth={6}>
      <div className="progress-value">
        {game?.completed && gameProgress === -1 && <FontAwesomeIcon icon={['fas', 'check']} aria-label="Completed" />}
        {!game?.completed && gameProgress === 0 && <FontAwesomeIcon icon={['fas', 'question']} aria-label="?" />}
        {gameProgress > 0 && (gameProgress === 100 ? <FontAwesomeIcon icon={['fas', 'crown']} aria-label="100%" /> : gameProgress)}
      </div>
    </CircularProgressbarWithChildren>
  </div> : null;
};

export default GameProgressIndicator;