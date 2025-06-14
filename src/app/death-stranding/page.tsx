import Image from 'next/image';
import FontAwesomeIcon from '../../components/FontAwesomeIcon';
import { getGameLibraryConfig } from '../../lib/Config';
import NotesService from '../../lib/NotesService';

import '../../styles/project.css';
import Link from 'next/link';

type Achievement = {
  id: number;
  title: string;
  description: string;
  progress?: number;
  type?: 'bronze' | 'silver' | 'gold' | 'platinum';
}

type Project = {
  id: number;
  achievements: Achievement[];
  help?: string;
}

type DeathStrandingLegendOfLegendProject = Project & {
  tracking: {
    name: string;
    status: number
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

type DeathStrandingCategoryProject = Project & {
  tracking: {
    name: string;
    status: number;
  }[];
}

type DeathStrandingNotesJSON = {
  projects: (
    DeathStrandingLegendOfLegendProject |
    DeathStrandingFacilityProject |
    DeathStrandingMemoryChipProject |
    DeathStrandingStructureProject |
    DeathStrandingFabricateProject |
    DeathStrandingCategoryProject
  )[];
}

const AchievementList = ({ achievements, getSprite }: { achievements: Achievement[], getSprite: (id: number) => string
 }): React.JSX.Element => {
  return (<ul className="achievement-list">
      {achievements.map(achievement => {
        return (
          <li key={achievement.id} className={achievement.progress === 100 ? 'completed' : 'in-progress'} style={{ '--progress': achievement.progress ? `${achievement.progress}%` : '0%' } as React.CSSProperties}>
            <span className="achievement-icon" style={{
              backgroundImage: `url("${getSprite(achievement.id)}")`,
              '--s': '64px',
              '--b': '10px',
              '--t': achievement.id
            } as React.CSSProperties}></span>
            <div className="achievement-details">
              <div className="achievement-progress"></div>
              <h3>
                {achievement.type && <span className={`achievement-type ${achievement.type}`}></span>}
                {achievement.title}
              </h3>
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
  const categoryProjectNotes = notesJSON.projects.find((project: Project) => project.id === 6) as DeathStrandingCategoryProject;
  const simpleProjects = notesJSON.projects.filter((project: Project) => ![0, 1, 2, 3, 4, 5, 6].includes(project.id)).sort((a, b) => a.id - b.id);

  const getAchievementSpriteById = (id: number): string => {
    if ([3, 7, 12].includes(id)) {
      return '/images/games/death-stranding-trophies2.jpg';
    }
    return '/images/games/death-stranding-trophies.jpg';
  };

  const updateAchievementProgress = (project: Project, achievementId: number, progress: number): void => {
    const achievement = project.achievements.find(a => a.id === achievementId);
    if (achievement) {
      achievement.progress = progress;
    }
  };

  let achievement_18 = 0;
  let achievement_19 = 0;
  legendOfLegendProjectNotes.tracking.forEach(item => {
    achievement_18 += item.status >= 10 ? 10 : item.status;
    achievement_19 += item.status >= 20 ? 20 : item.status;
  });
  updateAchievementProgress(legendOfLegendProjectNotes, 18,  achievement_18 / 40 * 100);
  updateAchievementProgress(legendOfLegendProjectNotes, 19,  achievement_19 / 80 * 100);

  const legendOfLegendTracking = (<ul className="tracking-list" style={{'--tracking-columns': 4} as React.CSSProperties}>
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

  let achievement_25 = 0;
  let achievement_27 = 0;
  facilityProjectNotes.tracking.forEach(item => {
    if (item.status === 1) {
      achievement_25 += 1;
    } else if (item.status === 2) {
      achievement_27 += 1;
    }
  });
  updateAchievementProgress(facilityProjectNotes, 25, achievement_25 / facilityProjectNotes.tracking.length * 100);
  updateAchievementProgress(facilityProjectNotes, 27, achievement_27 / facilityProjectNotes.tracking.length * 100);

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

  let achievement_35 = 0;
  memoryChipProjectNotes.tracking.status.forEach(status => {
    if (status > 0) {
      achievement_35++;
    }
  });
  updateAchievementProgress(memoryChipProjectNotes, 35, achievement_35 / memoryChipProjectNotes.tracking.max * 100);

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
  updateAchievementProgress(structureProjectNotes, 7, achievement_7 / structureProjectNotes.tracking.filter(item => item.upgraded !== undefined).length * 100);
  updateAchievementProgress(structureProjectNotes, 23, achievement_23 / structureProjectNotes.tracking.length * 100);

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

  let achievement_12 = 0;
  fabricateProjectNotes.tracking.forEach(category => {
    category.items.forEach(item => {
      if (item.status === 2) {
        achievement_12++;
      }
    });
  });
  updateAchievementProgress(fabricateProjectNotes, 12, achievement_12 / fabricateProjectNotes.tracking.reduce((acc, category) => acc + category.items.length, 0) * 100);

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

  let achievement_44 = 0;
  categoryProjectNotes.tracking.forEach(item => {
    achievement_44 += item.status >= 60 ? 60 : item.status;
  });
  updateAchievementProgress(categoryProjectNotes, 44, achievement_44 / (categoryProjectNotes.tracking.length * 60) * 100);

  const categoryTracking = (<ul className="tracking-list" style={{'--tracking-columns': 5} as React.CSSProperties}>
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

  let achievemt_0 = 49;
  achievemt_0 += legendOfLegendProjectNotes.achievements.filter(a => a.progress >= 100).length;
  achievemt_0 += facilityProjectNotes.achievements.filter(a => a.progress >= 100).length;
  achievemt_0 += memoryChipProjectNotes.achievements.filter(a => a.progress >= 100).length;
  achievemt_0 += structureProjectNotes.achievements.filter(a => a.progress >= 100).length;
  achievemt_0 += fabricateProjectNotes.achievements.filter(a => a.progress >= 100).length;
  achievemt_0 += categoryProjectNotes.achievements.filter(a => a.progress >= 100).length;
  simpleProjects.forEach(project => {
    achievemt_0 += project.achievements.filter(a => a.progress >= 100).length;
  });
  updateAchievementProgress(platinumProject, 0, achievemt_0 / 63 * 100);

  return (
    <div className='project-container'>
      <Link className="control-button" href="/" title="Back to Game Library">
        <FontAwesomeIcon icon={['fas', 'arrow-left']} />
        Back
      </Link>

      <h1>
        <Image alt="Death Stranding Director's Cut" width="500" height="281" src="images/games/death-stranding-logo.png" />
      </h1>

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
      <div>
        <ProjectHeader project={categoryProjectNotes} getSprite={getAchievementSpriteById} />
        {categoryTracking}
      </div>
      {simpleProjects.map((project: Project) => (
        <ProjectHeader key={project.id} project={project} getSprite={getAchievementSpriteById} />
      ))}
    </div>
  );
}