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

const MemoryChipTracking = (memoryChipProjectNotes: DeathStrandingMemoryChipProject): React.JSX.Element => {
  return <ul className="tracking-list" style={{'--tracking-columns': 4} as React.CSSProperties}>
    {memoryChipProjectNotes.tracking.chips.map((chip, index) => {
      const found = memoryChipProjectNotes.tracking.status.includes(index + 1);
      return (<li key={index}>
        <ToolTip text={`${chip}`}>
          <span className={`tracking-status ${found ? 'completed' : 'locked'}`}>
            <FontAwesomeIcon icon={['far', found ? 'check' : 'lock']} />
            <Link href={`${memoryChipProjectNotes.help}#Memory_Chip_${index + 1}`} rel="noreferrer" target="_blank">
              {found ? chip : `Memory Chip #${index + 1}`}
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