import FontAwesomeIcon from '../../FontAwesomeIcon';
import { Project } from '../ProjectContainer';

export type DeathStrandingFacilityProject = Project & {
  tracking: {
    region: string;
    facilities: {
      name: string;
      status: 0 | 1 | 2; // 0: Locked, 1: Unlocked, 2: Completed
    }[];
  }[];
}

const FacilityTracking = (facilityProjectNotes: DeathStrandingFacilityProject): React.JSX.Element => {
  return (<ul className="tracking-list">
    {facilityProjectNotes.tracking.map((region, regionIndex) => (
      <li key={regionIndex}>
        <span className="tracking-category">
          <strong>{region.region}</strong>
        </span>
        <ul className="tracking-items">
        {region.facilities.map((facility, facilityIndex) => (
          <li key={facilityIndex}>
            <span className={`tracking-status ${facility.status === 0 ? 'locked' : facility.status === 1 ? 'unlocked' : 'completed'}`}>
              <FontAwesomeIcon icon={['far', facility.status === 0 ? 'lock' : facility.status === 1 ? 'check' : 'check']} />
              <span className="tracking-text">{facility.name}</span>
            </span>
          </li>
        ))}
        </ul>
      </li>
    ))}
  </ul>);
};

const getFacilityAchievementProgress = (facilityProjectNotes: DeathStrandingFacilityProject): { achievement_25: number; achievement_27: number } => {
  let achievement_25 = 0;
  let achievement_27 = 0;
  let facilitiesCount = 0;
  facilityProjectNotes.tracking.forEach(region => {
    region.facilities.forEach(facility => {
      if (facility.status === 2) {
        achievement_27 += 1;
        achievement_25 += 1;
      } else if (facility.status === 1) {
        achievement_25 += 1;
      }
      facilitiesCount++;
    });
  });
  return {
    achievement_25: (achievement_25 / facilitiesCount) * 100,
    achievement_27: (achievement_27 / facilitiesCount) * 100
  };
};

export default FacilityTracking;
export { getFacilityAchievementProgress };
