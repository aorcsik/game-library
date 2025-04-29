import { JSX, memo } from 'react';
import dynamic from 'next/dynamic';

const FontAwesomeIcon = dynamic(
  () => import('../components/FontAwesomeIcon').then((mod) => mod.FontAwesomeIcon),
  { ssr: false }
);

const SortControl = ({
  sortBy,
  sortDirection,
  handleSortByChange,
  handleDirectionChange,
  sortByFieldName,
  sortDirectionFieldName
}: {
  sortBy: string;
  sortDirection: string;
  handleSortByChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleDirectionChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  sortByFieldName: string;
  sortDirectionFieldName: string;
}): JSX.Element => (
  <div className="button-group sort">
    <input 
      type="radio" 
      name={sortDirectionFieldName}
      value="asc" 
      defaultChecked={sortDirection === 'asc'} 
      id="sort-asc" 
      onChange={handleDirectionChange}
    />
    <label className="button" htmlFor="sort-asc"><FontAwesomeIcon icon={['far', sortBy === 'gameTitle' ? 'arrow-down-a-z' : 'arrow-down-1-9']} /></label>
    <input 
      type="radio" 
      name={sortDirectionFieldName}
      value="desc" 
      id="sort-desc"
      checked={sortDirection === 'desc'}
      onChange={handleDirectionChange}
    />
    <label className="button" htmlFor="sort-desc"><FontAwesomeIcon icon={['far', sortBy === 'gameTitle' ? 'arrow-up-z-a': 'arrow-up-9-1']} /></label>
    <label className="button form-field">
      <select 
        name={sortByFieldName} 
        value={sortBy} 
        id={sortByFieldName}
        onChange={handleSortByChange}
      >
        <option value="gameTitle">Title</option>
        <option value="gameReleaseDate">Release Date</option>
        <option value="openCriticScore">OpenCritic Score</option>
        <option value="openCriticCritics">OpenCritic Recommendation</option>
        <option value="steamReviewScore">Steam Reviews</option>
        <option value="metacriticScore">Metascore</option>
      </select>
    </label>
  </div>
);

export default memo(SortControl);