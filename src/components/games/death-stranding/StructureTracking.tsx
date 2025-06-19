import FontAwesomeIcon from '../../FontAwesomeIcon';
import { Project } from '../ProjectContainer';

export type DeathStrandingStructureProject = Project & {
  tracking: {
    name: string;
    completed: boolean;
    upgraded?: boolean;
  }[];
}

const StructureTracking = (structureProjectNotes: DeathStrandingStructureProject): React.JSX.Element => {
  return (<ul className="tracking-list" style={{'--tracking-columns': 6} as React.CSSProperties}>
    {structureProjectNotes.tracking.map((item, index) => (
      <li key={index}>
        <span className={`tracking-status ${item.upgraded === undefined || item.upgraded ? 'completed' : 'incomplete'}`}>
          <FontAwesomeIcon icon={['far', item.completed ? 'check' : 'lock']} />
          {item.name}
        </span>
      </li>
    ))}
  </ul>);
};

const getStructureAchievementProgress = (structureProjectNotes: DeathStrandingStructureProject): { achievement_7: number; achievement_23: number } => {
  let achievement_23 = 0;
  let achievement_7 = 0;
  structureProjectNotes.tracking.forEach(item => {
    if (item.upgraded) {
      achievement_7++;
    }
    if (item.completed) {
      achievement_23++;
    }
  });
  return {
    achievement_7: achievement_7 / structureProjectNotes.tracking.filter(item => item.upgraded !== undefined).length * 100,
    achievement_23: achievement_23 / structureProjectNotes.tracking.length * 100
  };
};

export default StructureTracking;
export { getStructureAchievementProgress };