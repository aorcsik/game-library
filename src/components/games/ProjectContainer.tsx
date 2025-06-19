import AchievementList, { Achievement } from './AchievementList';

export type Project = {
  id: number;
  achievements: Achievement[];
  help?: string;
}

type ProjectContainerProps = {
  project: Project;
  getSprite: (id: number) => string;
  children?: React.ReactNode;
}

const ProjectContainer = ({ project, getSprite, children}: ProjectContainerProps): React.JSX.Element => (
  <>
    <div className="project-header">
      {project.id ? (<h2>
        Project #{project.id}
        {project.help && <a href={project.help} target="_blank" rel="noreferrer">Help</a>}
      </h2>) : null}
      <AchievementList achievements={project.achievements} getSprite={getSprite} />
    </div>
    {children && <div className="project-content">
      {children}
    </div>}
  </>
);

const updateAchievementProgress = (project: Project, achievementId: number, progress: number): void => {
  const achievement = project.achievements.find(a => a.id === achievementId);
  if (achievement) {
    achievement.progress = progress;
  }
};

export default ProjectContainer;
export { updateAchievementProgress };