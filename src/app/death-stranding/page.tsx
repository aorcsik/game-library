import FontAwesomeIcon from '../../components/FontAwesomeIcon';
import { getGameLibraryConfig } from '../../lib/Config';
import NotesService from '../../lib/NotesService';

import '../../styles/project.css';

type Achievement = {
  id: number;
  title: string;
  description: string;
}

type Project = {
  id: number;
  achievements: Achievement[];
  help?: string;
  progress?: number;
}

type DeathStrandingLegendOfLegendProject = Project & {
  tracking: {
    name: string;
    status: number[]
  }[];
}

type DeathStrandingFacilityProject = Project & {
  tracking: {
    name: string;
    status: 0 | 1 | 2; // 0: Locked, 1: Unlocked, 2: Completed
  }[];
}

type DeathStrandingMemoryChipProject = Project & {
  tracking: {
    max: number;
    status: number[];
  };
}

type DeathStrandingStructureProject = Project & {
  tracking: {
    name: string;
    completed: boolean;
    upgraded?: boolean;
  }[];
}

type DeathStrandingFabricateProject = Project & {
  tracking: {
    category: string;
    items: {
      name: string;
      status: 0 | 1 | 2; // 0: Locked, 1: Unlocked, 2: Crafted
    }[];
  }[];
}

type DeathStrandingNotesJSON = {
  projects: (DeathStrandingLegendOfLegendProject | DeathStrandingFacilityProject | DeathStrandingMemoryChipProject | DeathStrandingStructureProject | DeathStrandingFabricateProject)[];
}

const AchievementList = ({ achievements, getSprite }: { achievements: Achievement[], getSprite: (id: number) => string
 }): React.JSX.Element => {
  return (<ul className="achievement-list">
      {achievements.map(achievement => {
        return (
          <li key={achievement.id}>
            <span className="achievement-icon" style={{
              backgroundImage: `url("${getSprite(achievement.id)}")`,
              '--s': '64px',
              '--b': '10px',
              '--t': achievement.id
            } as React.CSSProperties}></span>
            <div className="achievement-details">
              <h3>{achievement.title}</h3>
              <p>{achievement.description}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

const ProjectHeader = ({ project, getSprite}: { project: Project, getSprite: (id: number) => string}): React.JSX.Element => (
  <div className="project-header">
    {project.id ? (<h2>
      Project #{project.id}
      {project.help && <a href={project.help} target="_blank" rel="noreferrer">Help</a>}
    </h2>) : null}
    <AchievementList achievements={project.achievements} getSprite={getSprite} />
  </div>
);

export default async function Home(): Promise<React.JSX.Element> {
  const config = getGameLibraryConfig();
  const notesService = new NotesService(config);
  const gameNotes = (await notesService.getGameNotes(true)).filter(note => note.title === "DEATH STRANDING DIRECTOR'S CUT").pop();
  const notesJSON = gameNotes?.notesJSON && JSON.parse(gameNotes.notesJSON) as DeathStrandingNotesJSON;

  if (!notesJSON) {
    console.error('No notes found.');
    return (
      <div>
        <h1>Death Stranding</h1>
        <p>No notes available.</p>
      </div>
    );
  }

  const platinumProject = notesJSON.projects.find((project: Project) => project.id === 0);
  const legendOfLegendProjectNotes = notesJSON.projects.find((project: Project) => project.id === 1) as DeathStrandingLegendOfLegendProject;
  const facilityProjectNotes = notesJSON.projects.find((project: Project) => project.id === 2) as DeathStrandingFacilityProject;
  const memoryChipProjectNotes = notesJSON.projects.find((project: Project) => project.id === 3) as DeathStrandingMemoryChipProject;
  const structureProjectNotes = notesJSON.projects.find((project: Project) => project.id === 4) as DeathStrandingStructureProject;
  const fabricateProjectNotes = notesJSON.projects.find((project: Project) => project.id === 5) as DeathStrandingFabricateProject;
  const simpleProjects = notesJSON.projects.filter((project: Project) => ![0, 1, 2, 3, 4, 5].includes(project.id));

  const getAchievementSpriteById = (id: number): string => {
    if ([3, 7, 12].includes(id)) {
      return '/images/games/death-stranding-trophies2.jpg';
    }
    return '/images/games/death-stranding-trophies.jpg';
  };

  const legendOfLegendTracking = (<ul className="tracking-list" style={{'--tracking-columns': 1} as React.CSSProperties}>
    {legendOfLegendProjectNotes.tracking.map((item, index) => (
      <li key={index}>
        <span className={`tracking-status ${item.status.length > 20 ? 'completed' : 'incomplete'}`}>
          <FontAwesomeIcon icon={['far', item.status.length > 10 ? 'check' : 'lock']} />
          <span className="category-icon" style={{maskImage: `url("/images/games/death-stranding-${item.name.toLocaleLowerCase().replace(/\s+/g, '-')}.webp")` }}></span>
          <strong>{item.name}{': '}</strong>{item.status.join(', ') || 'n/a'}
        </span>
      </li>
    ))}
  </ul>);

  const facilityTracking = (<ul className="tracking-list">
    {facilityProjectNotes.tracking.map((item, index) => (
      <li key={index}>
        <span className={`tracking-status ${item.status === 0 ? 'locked' : item.status === 1 ? 'unlocked' : 'completed'}`}>
          <FontAwesomeIcon icon={['far', item.status === 0 ? 'lock' : item.status === 1 ? 'check' : 'check']} />
          {item.name}
        </span>
      </li>
    ))}
  </ul>);

  const memoryChipTracking = (<ul className="tracking-list" style={{'--tracking-columns': 6} as React.CSSProperties}>
    {[...Array(memoryChipProjectNotes.tracking.max).keys()].map((index) => (
      <li key={index}>
        <span className={`tracking-status ${memoryChipProjectNotes.tracking.status.includes(index + 1) ? 'completed' : 'locked'}`}>
          <FontAwesomeIcon icon={['far', memoryChipProjectNotes.tracking.status.includes(index + 1) ? 'check' : 'lock']} />
          Memory Chip #{index + 1}
        </span>
      </li>
    ))}
  </ul>);

  const structureTracking = (<ul className="tracking-list" style={{'--tracking-columns': 6} as React.CSSProperties}>
    {structureProjectNotes.tracking.map((item, index) => (
      <li key={index}>
        <span className={`tracking-status ${item.upgraded === undefined || item.upgraded ? 'completed' : 'incomplete'}`}>
          <FontAwesomeIcon icon={['far', item.completed ? 'check' : 'lock']} />
          {item.name}
        </span>
      </li>
    ))}
  </ul>);

  const fabricateTracking = (
    <ul className="tracking-list" style={{'--tracking-columns': 4} as React.CSSProperties}>
      {fabricateProjectNotes.tracking.map((category, index) => (
        <li key={index}>
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

  return (
    <div className='project-container'>
      <h1>Death Stranding</h1>

      <ProjectHeader project={platinumProject} getSprite={getAchievementSpriteById} />
      <div>
        <ProjectHeader project={legendOfLegendProjectNotes} getSprite={getAchievementSpriteById} />
        {legendOfLegendTracking}
      </div>
      <div>
        <ProjectHeader project={facilityProjectNotes} getSprite={getAchievementSpriteById} />
        {facilityTracking}
      </div>
      <div>
        <ProjectHeader project={memoryChipProjectNotes} getSprite={getAchievementSpriteById} />
        {memoryChipTracking}
      </div>
      <div>
        <ProjectHeader project={structureProjectNotes} getSprite={getAchievementSpriteById} />
        {structureTracking}
      </div>
      <div>
        <ProjectHeader project={fabricateProjectNotes} getSprite={getAchievementSpriteById} />
        {fabricateTracking}
      </div>
      {simpleProjects.map((project: Project) => (
        <ProjectHeader key={project.id} project={project} getSprite={getAchievementSpriteById} />
      ))}
    </div>
  );
}