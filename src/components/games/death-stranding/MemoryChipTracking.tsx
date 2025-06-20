import Link from 'next/link';
import FontAwesomeIcon from '../../FontAwesomeIcon';
import ToolTip from '../../Tooltip';
import { Project } from '../ProjectContainer';

export type DeathStrandingMemoryChipProject = Project & {
  tracking: {
    chips: string[];
    status: number[];
  };
}

const calculateTransposedIndexes = (max: number, columns: number): number[] => {
  const chipPerColumn = Math.ceil(max / columns);
  const transposedIndexes: number[] = [];
  for (let index = 0; index < chipPerColumn; index++) {
    for (let i = 0; i < columns; i++) {
      transposedIndexes.push(index + i * chipPerColumn);
    }
  }
  return transposedIndexes;
};

const MemoryChipTracking = (memoryChipProjectNotes: DeathStrandingMemoryChipProject): React.JSX.Element => {
  const COLUMNS = 5;
  const chipCount = memoryChipProjectNotes.tracking.chips.length;
  const transposedIndexes = calculateTransposedIndexes(chipCount, COLUMNS);
  return <ul className="tracking-list" style={{'--tracking-columns': COLUMNS} as React.CSSProperties}>
    {transposedIndexes.map((_, index) => {
      const chipId = index + 1;
      const orderCss = { '--order': transposedIndexes.indexOf(index) } as React.CSSProperties;
      if (index >= chipCount) {
        return <li className="empty" key={`empty-${chipId}`} style={orderCss}></li>;
      }
      const chipName = memoryChipProjectNotes.tracking.chips[index];
      const found = memoryChipProjectNotes.tracking.status.includes(chipId);
      return (<li key={`chip-${chipId}`} style={orderCss}>
        <ToolTip text={`${chipName}`}>
          <span className={`tracking-status ${found ? 'completed' : 'locked'}`}>
            <FontAwesomeIcon icon={['far', found ? 'check' : 'lock']} />
            <Link href={`${memoryChipProjectNotes.help}#Memory_Chip_${chipId}`} rel="noreferrer" target="_blank" className='tracking-text'>
              {found ? chipName : `Memory Chip #${chipId}`}
            </Link>
          </span>
        </ToolTip>
      </li>);
    })}
  </ul>;
};

const getMemoryChipAchievementProgress = (memoryChipProjectNotes: DeathStrandingMemoryChipProject): { achievement_35: number } => {
  let achievement_35 = 0;
  memoryChipProjectNotes.tracking.status.forEach(status => {
    if (status > 0) {
      achievement_35++;
    }
  });
  return {
    achievement_35: achievement_35 / memoryChipProjectNotes.tracking.chips.length * 100
  };
};

export default MemoryChipTracking;
export { getMemoryChipAchievementProgress };