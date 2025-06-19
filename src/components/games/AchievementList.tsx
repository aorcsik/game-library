import ToolTip from '../Tooltip';

export type Achievement = {
  id: number;
  title: string;
  description: string;
  progress?: number;
  type?: 'bronze' | 'silver' | 'gold' | 'platinum';
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
            <ToolTip
              align='right'
              className='achievement-details'
              text={`${achievement.progress ? Math.floor(achievement.progress) : 0}%`}
            >
              <div className="achievement-progress"></div>
              <h3>
                {achievement.type && <span className={`achievement-type ${achievement.type}`}></span>}
                {achievement.title}
              </h3>
              <p>{achievement.description}</p>
            </ToolTip>
          </li>
        );
      })}
    </ul>
  );
};

export default AchievementList;