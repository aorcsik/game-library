import { PLATFORM_GROUPS, platformGroup } from '../model';
import { PlatformIcon } from './PlatformIcon';

export const PlatformFilter = ({ labels, selected = [], includeMixed = false, apply = false }: {
  labels: string[]; selected?: string[]; includeMixed?: boolean; apply?: boolean;
}) => (
  <details class="filter-dropdown platform-filter" data-filter-dropdown>
    <summary><span>Platform</span><small data-filter-count>{selected.length ? `${selected.length} selected` : 'All'}</small></summary>
    <label class="filter-select-all"><input type="checkbox" data-select-all /> Select all</label>
    <div class="filter-options platform-options">
      {Object.keys(PLATFORM_GROUPS)
        .map(group => [group, [...labels, ...(includeMixed ? ['mixed'] : [])].filter(label => platformGroup(label) === group)] as const)
        .filter(([, list]) => list.length > 0)
        .map(([group, list]) => (
          <div class="platform-filter-group" data-filter-group={group.toLowerCase()}>
            <label><input type="checkbox" data-group-toggle={group} /> {group}</label>
            <div class="platform-filter-labels">
              {list.map(label => (
                <label data-filter-option={label.toLowerCase()}><input type="checkbox" name="platform" value={label} data-group={group} checked={selected.includes(label)} /> <PlatformIcon label={label} withLabel /></label>
              ))}
            </div>
          </div>
        ))}
    </div>
    {apply && <button type="submit" class="platform-filter-apply">Apply</button>}
  </details>
);