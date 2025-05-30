import { JSX, memo, useRef } from 'react';
import FontAwesomeIcon from './FontAwesomeIcon';


const SearchControl = ({ 
  searchQuery, 
  handleSearch,
  handleClearSearch,
  searchFieldName 
}: {
  searchQuery: string;
  handleSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleClearSearch: (e: React.MouseEvent<HTMLButtonElement>) => void;
  searchFieldName: string;
}): JSX.Element => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (  
    <div className="form-field search-field">
      <div className="search-icon">
        <FontAwesomeIcon icon={['far', 'magnifying-glass']} />
      </div>
      <input 
        ref={inputRef}
        key="search-input"
        type="text" 
        id={searchFieldName}
        placeholder="Search games"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck="false"
        aria-label="Search games"
        name={searchFieldName}
        value={searchQuery}
        onChange={handleSearch}
      />
      <button 
        className="cancel-button"
        onClick={(event) => { handleClearSearch(event); inputRef.current?.focus(); }}
        style={{ visibility: searchQuery ? 'visible' : 'hidden' }}
      >
        <FontAwesomeIcon icon={['far', 'xmark']} />
      </button>
    </div>
  );
};

export default memo(SearchControl);