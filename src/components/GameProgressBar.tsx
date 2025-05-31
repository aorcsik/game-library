import { JSX } from 'react';

const GameProgressBar = ({ progress }: { progress: number | undefined; }): JSX.Element => {
  return <span className="game-progress-container">
    <span className="game-progress-bar" style={{ width: `${progress || 0}%` }}>
      <span className="game-progress-label">
        {progress !== undefined ? `${progress}%` : ''}
      </span>
    </span>
  </span>;
};

export default GameProgressBar;