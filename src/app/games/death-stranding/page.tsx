import Image from 'next/image';
import Link from 'next/link';

import FontAwesomeIcon from '../../../components/FontAwesomeIcon';
import { getGameLibraryConfig } from '../../../lib/Config';
import NotesService from '../../../lib/NotesService';

import ProjectContainer, { Project, updateAchievementProgress } from '../../../components/games/ProjectContainer';
import MemoryChipTracking, { DeathStrandingMemoryChipProject, getMemoryChipAchievementProgress } from '../../../components/games/death-stranding/MemoryChipTracking';
import FacilityTracking, { DeathStrandingFacilityProject, getFacilityAchievementProgress } from '../../../components/games/death-stranding/FacilityTracking';
import CategoryTracking, { DeathStrandingCategoryProject, getCategoryAchievementProgress } from '../../../components/games/death-stranding/CategoryTracking';
import LegendOfLegendTracking, { DeathStrandingLegendOfLegendProject, getLegendOfLegendAchievementProgress } from '../../../components/games/death-stranding/LegendOfLegendTracking';
import StructureTracking, { DeathStrandingStructureProject, getStructureAchievementProgress } from '../../../components/games/death-stranding/StructureTracking';
import FabricateTracking, { DeathStrandingFabricateProject, getFabricateAchievementProgress } from '../../../components/games/death-stranding/FabricateTracking';

import '../../../styles/project.css';


type DeathStrandingNotesJSON = {
  projects: (
    Project |
    DeathStrandingLegendOfLegendProject |
    DeathStrandingFacilityProject |
    DeathStrandingMemoryChipProject |
    DeathStrandingStructureProject |
    DeathStrandingFabricateProject |
    DeathStrandingCategoryProject
  )[];
}

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

  const platinumProject = notesJSON.projects.find((project: Project) => project.id === 0) as Project;
  const legendOfLegendProjectNotes = notesJSON.projects.find((project: Project) => project.id === 1) as DeathStrandingLegendOfLegendProject;
  const facilityProjectNotes = notesJSON.projects.find((project: Project) => project.id === 2) as DeathStrandingFacilityProject;
  const memoryChipProjectNotes = notesJSON.projects.find((project: Project) => project.id === 3) as DeathStrandingMemoryChipProject;
  const structureProjectNotes = notesJSON.projects.find((project: Project) => project.id === 4) as DeathStrandingStructureProject;
  const fabricateProjectNotes = notesJSON.projects.find((project: Project) => project.id === 5) as DeathStrandingFabricateProject;
  const categoryProjectNotes = notesJSON.projects.find((project: Project) => project.id === 6) as DeathStrandingCategoryProject;
  const simpleProjects = notesJSON.projects.filter((project: Project) => ![0, 1, 2, 3, 4, 5, 6].includes(project.id)).sort((a, b) => a.id - b.id) as Project[];

  const getAchievementSpriteById = (id: number): string => {
    if ([3, 7, 12].includes(id)) {
      return '/images/games/death-stranding-trophies2.jpg';
    }
    return '/images/games/death-stranding-trophies.jpg';
  };

  const { achievement_18, achievement_19 } = getLegendOfLegendAchievementProgress(legendOfLegendProjectNotes);
  updateAchievementProgress(legendOfLegendProjectNotes, 18, achievement_18);
  updateAchievementProgress(legendOfLegendProjectNotes, 19, achievement_19);

  const { achievement_25, achievement_27 } = getFacilityAchievementProgress(facilityProjectNotes);
  updateAchievementProgress(facilityProjectNotes, 25, achievement_25);
  updateAchievementProgress(facilityProjectNotes, 27, achievement_27);

  const { achievement_35 } = getMemoryChipAchievementProgress(memoryChipProjectNotes);
  updateAchievementProgress(memoryChipProjectNotes, 35, achievement_35);

  const { achievement_7, achievement_23 } = getStructureAchievementProgress(structureProjectNotes);
  updateAchievementProgress(structureProjectNotes, 7, achievement_7);
  updateAchievementProgress(structureProjectNotes, 23, achievement_23);

  const { achievement_12 } = getFabricateAchievementProgress(fabricateProjectNotes);
  updateAchievementProgress(fabricateProjectNotes, 12, achievement_12);

  const achievement_44 = getCategoryAchievementProgress(categoryProjectNotes);
  updateAchievementProgress(categoryProjectNotes, 44, achievement_44);

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
    <main>
      <Link className="control-button" href="/" title="Back to Game Library">
        <FontAwesomeIcon icon={['fas', 'arrow-left']} />
        Back
      </Link>

      <h1>
        <Image alt="Death Stranding Director's Cut" width="500" height="281" src="/images/games/death-stranding-logo.png" />
      </h1>

      <ProjectContainer project={platinumProject} getSprite={getAchievementSpriteById} />

      <ProjectContainer project={legendOfLegendProjectNotes} getSprite={getAchievementSpriteById}>
        <LegendOfLegendTracking {...legendOfLegendProjectNotes} />
      </ProjectContainer>

      <ProjectContainer project={facilityProjectNotes} getSprite={getAchievementSpriteById}>
        <FacilityTracking {...facilityProjectNotes} />
      </ProjectContainer>

      <ProjectContainer project={memoryChipProjectNotes} getSprite={getAchievementSpriteById}>
        <MemoryChipTracking {...memoryChipProjectNotes} />
      </ProjectContainer>

      <ProjectContainer project={structureProjectNotes} getSprite={getAchievementSpriteById}>
        <StructureTracking {...structureProjectNotes} />
      </ProjectContainer>

      <ProjectContainer project={fabricateProjectNotes} getSprite={getAchievementSpriteById}>
        <FabricateTracking {...fabricateProjectNotes} />
      </ProjectContainer>

      <ProjectContainer project={categoryProjectNotes} getSprite={getAchievementSpriteById}>
        <CategoryTracking {...categoryProjectNotes} />
      </ProjectContainer>

      {simpleProjects.map((project: Project) => (
        <ProjectContainer key={project.id} project={project} getSprite={getAchievementSpriteById} />
      ))}
    </main>
  );
}