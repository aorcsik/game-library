import FontAwesomeIcon from '../../FontAwesomeIcon';
import { Project } from '../ProjectContainer';

export type DeathStrandingFabricateProject = Project & {
  tracking: {
    category: string;
    items: {
      name: string;
      status: 0 | 1 | 2; // 0: Locked, 1: Unlocked, 2: Crafted
    }[];
  }[];
}

const FabricateTracking = (fabricateProjectNotes: DeathStrandingFabricateProject): React.JSX.Element => {
  return (
    <ul className="tracking-list" style={{'--tracking-columns': 4} as React.CSSProperties}>
      {fabricateProjectNotes.tracking.map((category, categoryIndex) => (
        <li key={categoryIndex}>
          <span className="tracking-category">
            <strong>{category.category}</strong>
          </span>
          <ul className="tracking-items">
            {category.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <span className={`tracking-status ${item.status === 2 ? 'completed' : 'incomplete'}`}>
                  <FontAwesomeIcon icon={['far', item.status === 0 ? 'lock' : item.status === 1 ? 'check' : 'check']} />
                  {item.name}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
};

const getFabricateAchievementProgress = (fabricateProjectNotes: DeathStrandingFabricateProject): { achievement_12: number } => {
  let achievement_12 = 0;
  fabricateProjectNotes.tracking.forEach(category => {
    category.items.forEach(item => {
      if (item.status === 2) {
        achievement_12++;
      }
    });
  });
  return {
    achievement_12: achievement_12 / fabricateProjectNotes.tracking.reduce((acc, category) => acc + category.items.length, 0) * 100
  };
};

export default FabricateTracking;
export { getFabricateAchievementProgress };
