import FontAwesomeIcon from '../../FontAwesomeIcon';
import { Project } from '../ProjectContainer';

export type DeathStrandingLegendOfLegendProject = Project & {
  tracking: {
    name: string;
    status: number
  }[];
}

const LegendOfLegendTracking = (legendOfLegendProjectNotes: DeathStrandingLegendOfLegendProject): React.JSX.Element => {
  return (<ul className="tracking-list" style={{'--tracking-columns': 4} as React.CSSProperties}>
    {legendOfLegendProjectNotes.tracking.map((item, index) => (
      <li key={index}>
        <span className={`tracking-status ${item.status >= 20 ? 'completed' : 'incomplete'}`}>
          <FontAwesomeIcon icon={['far', item.status >= 10 ? 'check' : 'lock']} />
          <span className="category-icon" style={{maskImage: `url("/images/games/death-stranding-${item.name.toLocaleLowerCase().replace(/\s+/g, '-')}.webp")` }}></span>
          <strong>{item.name}{': '}</strong>{item.status}
        </span>
      </li>
    ))}
  </ul>);
};

const getLegendOfLegendAchievementProgress = (legendOfLegendProjectNotes: DeathStrandingLegendOfLegendProject): { achievement_18: number; achievement_19: number } => {
  let achievement_18 = 0;
  let achievement_19 = 0;
  legendOfLegendProjectNotes.tracking.forEach(item => {
    achievement_18 += item.status >= 10 ? 10 : item.status;
    achievement_19 += item.status >= 20 ? 20 : item.status;
  });
  return {
    achievement_18: (achievement_18 / 40) * 100,
    achievement_19: (achievement_19 / 80) * 100
  };
};

export default LegendOfLegendTracking;
export { getLegendOfLegendAchievementProgress };