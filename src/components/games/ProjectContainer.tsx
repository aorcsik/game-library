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

const ProjectContainer = ({ project, getSprite, children}: ProjectContainerProps): React.JSX.Element => {
  let hasIncompleteAchievements = false;
  project.achievements.forEach(achievement => {
    if (achievement.progress < 100) {
      hasIncompleteAchievements = true;
    }
  });

  return (
    <div className="project-container">
      {children && <input type="checkbox" className="project-toggle" id={`project-${project.id}`} defaultChecked={hasIncompleteAchievements} />}
      <div className="project-header">
        <div className="project-header-top">
          {project.id || project.id === 0 ? (<h2>
            Project #{project.id}
            {project.help && <a href={project.help} target="_blank" rel="noreferrer">Help</a>}
          </h2>) : null}
          {children && <label htmlFor={`project-${project.id}`} className="project-toggle-label">
            <i className="fas fa-chevron-down"></i>
          </label>}
        </div>
        <AchievementList achievements={project.achievements} getSprite={getSprite} />
      </div>
      {children && <div className="project-content">
        {children}
      </div>}
    </div>
  );
};

const updateAchievementProgress = (project: Project, achievementId: number, progress: number): void => {
  const achievement = project.achievements.find(a => a.id === achievementId);
  if (achievement) {
    achievement.progress = progress;
  }
};

export default ProjectContainer;
export { updateAchievementProgress };