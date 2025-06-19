import FontAwesomeIcon from '../../FontAwesomeIcon';
import { Project } from '../ProjectContainer';

export type DeathStrandingCategoryProject = Project & {
  tracking: {
    name: string;
    status: number;
  }[];
}

const CategoryTracking = (categoryProjectNotes: DeathStrandingCategoryProject): React.JSX.Element => {
  return (<ul className="tracking-list" style={{'--tracking-columns': 5} as React.CSSProperties}>
    {categoryProjectNotes.tracking.map((item, index) => (
      <li key={index}>
        <span className={`tracking-status ${item.status >= 60 ? 'completed' : 'locked'}`}>
          <FontAwesomeIcon icon={['far', item.status >= 60 ? 'check' : 'lock']} />
          <span className="category-icon" style={{maskImage: `url("/images/games/death-stranding-${item.name.toLocaleLowerCase().replace(/\s+/g, '-')}.webp")` }}></span>
          <strong>{item.name}{': '}</strong>{item.status}
        </span>
      </li>
    ))}
  </ul>);
};

const getCategoryAchievementProgress = (categoryProjectNotes: DeathStrandingCategoryProject): number => {
   let achievement_44 = 0;
  categoryProjectNotes.tracking.forEach(item => {
    achievement_44 += item.status >= 60 ? 60 : item.status;
  });
  return achievement_44 / (categoryProjectNotes.tracking.length * 60) * 100;
};

export default CategoryTracking;
export { getCategoryAchievementProgress };