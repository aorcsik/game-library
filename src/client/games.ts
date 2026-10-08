const SORT_KEYS = ['title', 'purchased', 'firstPurchased', 'release', 'oc', 'mc', 'steam'] as const;
type SortKey = typeof SORT_KEYS[number];
const NUMERIC: SortKey[] = ['oc', 'mc', 'steam'];
const MULTI = { platform: 'labels', access: 'access', status: 'status', rating: 'rating', tier: 'tier', mcb: 'mcb', steam: 'steamReview', genre: 'genres' } as const;

/** Group checkbox mirrors its platforms: checked if all, indeterminate if some. */
export const syncGroupToggles = (form: HTMLFormElement): void => {
  form.querySelectorAll<HTMLInputElement>('[data-group-toggle]').forEach(toggle => {
    const children = [...form.querySelectorAll<HTMLInputElement>(`input[data-group="${toggle.dataset.groupToggle}"]`)];
    const checked = children.filter(c => c.checked).length;
    toggle.checked = checked > 0 && checked === children.length;
    toggle.indeterminate = checked > 0 && checked < children.length;
  });
};

export const syncSelectAllToggles = (form: HTMLFormElement, changed?: HTMLInputElement): void => {
  if (changed?.hasAttribute('data-select-all')) {
    changed.closest('[data-filter-dropdown]')?.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name]').forEach(option => {
      option.checked = changed.checked;
    });
  }
  form.querySelectorAll<HTMLInputElement>('[data-select-all]').forEach(toggle => {
    const options = [...(toggle.closest('[data-filter-dropdown]')?.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name]') ?? [])];
    const checked = options.filter(option => option.checked).length;
    toggle.checked = options.length > 0 && checked === options.length;
    toggle.indeterminate = checked > 0 && checked < options.length;
  });
};

/** Client-side sort/filter of both games views; state lives in the URL query. */
export const initGameList = (form: HTMLFormElement): void => {
  const tbody = document.querySelector<HTMLTableSectionElement>('#games tbody');
  const table = document.querySelector<HTMLTableElement>('#games');
  const cards = document.querySelector<HTMLElement>('#game-cards');
  const count = form.querySelector<HTMLElement>('[data-game-count]');
  if (!tbody || !table || !cards) return;
  const columnCount = tbody.closest('table')?.querySelectorAll('thead th').length ?? 1;
  const rows = [...tbody.querySelectorAll<HTMLTableRowElement>('tr[data-game]')];
  const cardByKey = new Map([...cards.querySelectorAll<HTMLElement>('[data-game-card]')].map(card => [card.dataset.key, card]));

  const params = new URLSearchParams(location.search);
  if (params.size) {
    for (const el of form.elements) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement) || !el.name) continue;
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio') && params.has(el.name)) el.checked = params.getAll(el.name).includes(el.value);
      else if (params.has(el.name)) el.value = params.get(el.name)!;
    }
  }

  const updateDropdowns = (): void => {
    for (const dropdown of form.querySelectorAll<HTMLDetailsElement>('[data-filter-dropdown]')) {
      const term = dropdown.querySelector<HTMLInputElement>('[data-filter-search]')?.value.trim().toLowerCase() ?? '';
      const options = [...dropdown.querySelectorAll<HTMLElement>('[data-filter-option]')];
      for (const option of options) {
        const group = option.closest<HTMLElement>('[data-filter-group]');
        const groupMatches = !!term && !!group?.dataset.filterGroup?.includes(term);
        const checkbox = option.querySelector<HTMLInputElement>('input[type="checkbox"]');
        option.hidden = !!term && !groupMatches && !option.dataset.filterOption?.includes(term) && !checkbox?.checked;
      }
      dropdown.querySelectorAll<HTMLElement>('[data-filter-group]').forEach(group => {
        group.hidden = !!term && !group.querySelector('[data-filter-option]:not([hidden])');
      });
      const selectedCount = [...dropdown.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name]')].filter(input => input.checked).length;
      const count = dropdown.querySelector<HTMLElement>('[data-filter-count]');
      if (count) count.textContent = selectedCount ? `${selectedCount} selected` : 'All';
    }
  };

  const apply = (): void => {
    const data = new FormData(form);
    const terms = String(data.get('q') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const selected = Object.fromEntries(Object.keys(MULTI).map(name => [name, data.getAll(name).map(String)])) as Record<keyof typeof MULTI, string[]>;
    const sort = (SORT_KEYS as readonly string[]).includes(String(data.get('sort'))) ? String(data.get('sort')) as SortKey : 'title';
    const desc = data.get('dir') === 'desc';

    let visible = 0;
    for (const row of rows) {
      const d = row.dataset;
      const show = terms.every(t => (d.search ?? '').includes(t))
        && (Object.keys(MULTI) as (keyof typeof MULTI)[]).every(name => {
          if (!selected[name].length) return true;
          if (name === 'access' && selected.access.includes('all')) return true;
          const values = name === 'genre'
            ? (d[MULTI[name]] ?? '').split('|')
            : (d[MULTI[name]] ?? '').split(',');
          return selected[name].some(v => values.includes(v));
        });
      row.hidden = !show;
      const card = cardByKey.get(d.key);
      if (card) card.hidden = !show;
      if (show) visible++;
    }

    // Empty values sort last in both directions.
    const value = (row: HTMLTableRowElement): string | number | null => {
      const raw = row.dataset[sort] ?? '';
      if (raw === '') return null;
      return NUMERIC.includes(sort) ? Number(raw) : raw;
    };
    const sorted = [...rows].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return (desc ? -cmp : cmp) || (a.dataset.title ?? '').localeCompare(b.dataset.title ?? '');
    });
    tbody.querySelectorAll('[data-game-month]').forEach(heading => heading.remove());
    if (sort === 'release' || sort === 'purchased' || sort === 'firstPurchased') {
      const monthFor = (row: HTMLTableRowElement): string => {
        const raw = row.dataset[sort] ?? '';
        if (!/^\d{4}-\d{2}/.test(raw)) return sort === 'release' ? 'No release date' : 'No purchase date';
        const date = new Date(`${raw.slice(0, 7)}-01T00:00:00`);
        return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
      };
      const visibleByMonth = new Map<string, number>();
      for (const row of sorted) {
        if (!row.hidden) {
          const month = monthFor(row);
          visibleByMonth.set(month, (visibleByMonth.get(month) ?? 0) + 1);
        }
      }
      let previousMonth = '';
      for (const row of sorted) {
        const month = monthFor(row);
        if (month !== previousMonth) {
          const heading = document.createElement('tr');
          heading.dataset.gameMonth = '';
          heading.className = 'game-month-heading';
          heading.hidden = !visibleByMonth.has(month);
          const cell = document.createElement('th');
          cell.colSpan = columnCount;
          cell.scope = 'rowgroup';
          cell.textContent = month;
          const monthCount = document.createElement('small');
          monthCount.textContent = String(visibleByMonth.get(month) ?? 0);
          cell.append(' ', monthCount);
          heading.append(cell);
          tbody.append(heading);
          previousMonth = month;
        }
        tbody.append(row);
      }
    } else {
      tbody.append(...sorted);
    }
    cards.append(...sorted.map(row => cardByKey.get(row.dataset.key)).filter((card): card is HTMLElement => !!card));
    const cardView = data.get('view') === 'cards';
    table.hidden = cardView;
    cards.hidden = !cardView;
    if (count) count.textContent = `${visible} shown`;
    updateDropdowns();

    const query = new URLSearchParams();
    for (const [key, v] of data) if (v !== '') query.append(key, String(v));
    if (!selected.access.length) query.append('access', 'all');
    history.replaceState(null, '', `${location.pathname}${query.size ? `?${query}` : ''}`);
  };

  form.addEventListener('input', apply);
  form.addEventListener('change', event => {
    const target = event.target as HTMLInputElement;
    if (target.dataset.groupToggle) {
      form.querySelectorAll<HTMLInputElement>(`input[data-group="${target.dataset.groupToggle}"]`).forEach(c => { c.checked = target.checked; });
    }
    syncSelectAllToggles(form, target);
    syncGroupToggles(form);
    apply();
  });
  form.addEventListener('submit', event => event.preventDefault());
  syncGroupToggles(form);
  syncSelectAllToggles(form);
  updateDropdowns();
  apply();
};

export const initPersonalStateMode = (toggle: HTMLInputElement): void => {
  const table = document.querySelector<HTMLTableElement>('#games');
  if (!table) return;
  const update = (): void => {
    const mode = toggle.checked ? 'peak' : 'latest';
    document.querySelectorAll<HTMLElement>('.personal-state-cell, .game-card-state').forEach(cell => {
      cell.dataset.stateMode = mode;
    });
    table.querySelectorAll<HTMLTableRowElement>('tr[data-game]').forEach(row => {
      row.dataset.status = toggle.checked ? row.dataset.statusPeak : row.dataset.statusLatest;
    });
    document.querySelector<HTMLFormElement>('[data-game-controls]')?.dispatchEvent(new Event('input', { bubbles: true }));
  };
  toggle.addEventListener('change', update);
  update();
};
