import { Children, JSX, ReactElement, isValidElement, memo } from 'react';


type FilterOptionProps = {
  name: string;
  value: string;
};

type SelectableFilterOptions = Record<string, { label: string; options: Record<string, string> }>;

const FilterOption = (_props: FilterOptionProps): JSX.Element | null => null;

const FilterControlComponent = ({
  name,
  selectableOptions,
  handleFilterChange,
  children
}: {
  name: string;
  selectableOptions: SelectableFilterOptions;
  handleFilterChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: ReactElement<FilterOptionProps> | ReactElement<FilterOptionProps>[];
}): JSX.Element => {
  const filters = Children.toArray(children).filter(isValidElement) as ReactElement<FilterOptionProps>[];

  return (
    <div className="button-group filter" data-control-name={name}>
      {filters.map((filter) => {
        const fieldName = filter.props.name;
        const fieldConfig = selectableOptions[fieldName];
        if (!fieldConfig) return null;

        return (
          <label className="button form-field" key={fieldName}>
            <span className="sr-only">{fieldConfig.label}</span>
            <select
              name={fieldName}
              id={fieldName}
              value={filter.props.value || ''}
              onChange={handleFilterChange}
            >
              <option value="">All {fieldConfig.label}</option>
              {Object.entries(fieldConfig.options).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
};

const FilterControl = memo(FilterControlComponent);

export default Object.assign(FilterControl, { FilterOption });