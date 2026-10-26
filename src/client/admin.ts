import { initGameList, initPersonalStateMode, syncGroupToggles, syncSelectAllToggles } from './games';
import { initPopovers } from './popover';
import { initPersonalDialog } from './personal';
import { initRefreshQueue } from './queueStatus';
import { initGameRefreshButton, initRefreshOrchestrator } from './refresh';

const on = <K extends keyof DocumentEventMap>(type: K, selector: string, handler: (el: HTMLElement, event: DocumentEventMap[K]) => void): void => {
  document.addEventListener(type, event => {
    const el = (event.target as Element | null)?.closest<HTMLElement>(selector);
    if (el) handler(el, event);
  });
};

on('click', '[data-action="add-item"]', () => {
  const template = document.querySelector<HTMLTemplateElement>('#item-template');
  const container = document.querySelector<HTMLElement>('[data-items]');
  if (!template || !container) return;
  const index = Number(container.dataset.nextIndex ?? container.children.length);
  container.dataset.nextIndex = String(index + 1);
  const fragment = template.content.cloneNode(true) as DocumentFragment;
  fragment.querySelectorAll<HTMLInputElement>('[name]').forEach(input => {
    input.name = input.name.replace('__index__', String(index));
  });
  const last = container.querySelector<HTMLFieldSetElement>('[data-item]:last-of-type');
  const platform = last?.querySelector<HTMLSelectElement>('select[name$="[platform]"]')?.value;
  container.append(fragment);
  const added = container.lastElementChild as HTMLElement;
  const platformSelect = added.querySelector<HTMLSelectElement>('select[name$="[platform]"]');
  if (platform && platformSelect) platformSelect.value = platform;
  added.querySelector<HTMLInputElement>('input[name$="[title]"]')?.focus();
});

on('click', '[data-action="remove-item"]', el => {
  el.closest('[data-item]')?.remove();
});

const setExpanded = (block: Element, expanded: boolean): void => {
  const button = block.querySelector<HTMLButtonElement>('[data-action="toggle-items"]');
  const items = block.querySelector<HTMLElement>('[data-items]');
  if (!button || !items) return;
  items.hidden = !expanded;
  button.textContent = expanded ? '−' : '+';
  button.setAttribute('aria-expanded', String(expanded));
  button.setAttribute('aria-label', `${expanded ? 'Hide' : 'Show'} ${button.dataset.itemLabel ?? 'items'}`);
};

on('click', '[data-action="toggle-items"]', el => {
  const block = el.closest('[data-expandable]');
  if (block) setExpanded(block, el.getAttribute('aria-expanded') !== 'true');
});

on('click', '[data-action="expand-all"]', el => {
  const expand = el.dataset.expanded !== 'true';
  el.dataset.expanded = String(expand);
  el.textContent = expand ? 'Collapse all' : 'Expand all';
  document.querySelector(el.dataset.target ?? '')?.querySelectorAll('[data-expandable]').forEach(block => setExpanded(block, expand));
});

on('click', '.creator-list [data-creator-sort]', el => {
  const table = el.closest<HTMLTableElement>('table.creator-list');
  if (!table) return;
  const sort = el.dataset.creatorSort;
  const byGames = sort === 'games';
  const direction = table.dataset.sort === sort && table.dataset.direction === 'asc' ? 'desc'
    : table.dataset.sort === sort ? 'asc' : byGames ? 'desc' : 'asc';
  table.dataset.sort = sort;
  table.dataset.direction = direction;
  const rows = [...table.querySelectorAll<HTMLTableSectionElement>('tbody[data-expandable]')];
  rows.sort((a, b) => {
    const names = (a.dataset.creatorName ?? '').localeCompare(b.dataset.creatorName ?? '');
    if (!byGames) return direction === 'asc' ? names : -names;
    const counts = Number(a.dataset.gameCount) - Number(b.dataset.gameCount);
    return (direction === 'asc' ? counts : -counts) || names;
  });
  table.append(...rows);
  table.querySelectorAll<HTMLButtonElement>('[data-creator-sort]').forEach(button => {
    const header = button.closest('th');
    if (button === el) header?.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
    else header?.removeAttribute('aria-sort');
    const indicator = button.querySelector<HTMLElement>('[data-sort-indicator]');
    if (indicator) indicator.textContent = button === el ? direction === 'asc' ? '↑' : '↓' : '';
  });
});

on('click', '[data-heatmap-tab]', el => {
  el.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[data-heatmap-tab]').forEach(tab => {
    const selected = tab === el;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(tab.getAttribute('aria-controls') ?? '');
    if (panel) panel.hidden = !selected;
  });
});

on('keydown', '[data-heatmap-tab]', (el, event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...(el.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[data-heatmap-tab]') ?? [])];
  const current = tabs.indexOf(el as HTMLButtonElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
    : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault();
  tabs[next]?.focus();
  tabs[next]?.click();
});

on('input', '[data-cover-input]', el => {
  const input = el as HTMLInputElement;
  const img = input.closest('[data-item]')?.querySelector<HTMLImageElement>('[data-cover-preview]');
  if (!img) return;
  const valid = /^https?:\/\//.test(input.value);
  img.hidden = !valid;
  if (valid) img.src = input.value;
});

document.querySelectorAll<HTMLImageElement>('[data-game-cover], .cover-choice [data-cover-preview]').forEach(img => {
  const unavailable = (): void => {
    img.hidden = true;
    const placeholder = img.nextElementSibling;
    if (placeholder instanceof HTMLElement && placeholder.matches('.game-card-no-cover, .cover-choice-empty')) placeholder.hidden = false;
    const option = img.closest('.cover-choice')?.querySelector<HTMLInputElement>('input[name="coverSource"]');
    if (option && !option.checked) option.disabled = true;
    const notice = img.closest('.game-head')?.querySelector<HTMLElement>('[data-missing-cover]');
    if (notice) notice.hidden = false;
  };
  img.addEventListener('error', unavailable);
  if (img.complete && !img.naturalWidth) unavailable();
});

on('change', '[data-autosubmit]', el => {
  (el as HTMLSelectElement).form?.requestSubmit();
});

const transactionFilters = document.querySelector<HTMLFormElement>('[data-transaction-filters]');
if (transactionFilters) {
  transactionFilters.addEventListener('change', event => {
    const input = event.target as HTMLInputElement;
    if (input.dataset.groupToggle) {
      transactionFilters.querySelectorAll<HTMLInputElement>(`input[data-group="${input.dataset.groupToggle}"]`).forEach(child => {
        child.checked = input.checked;
      });
    }
    syncSelectAllToggles(transactionFilters, input);
    syncGroupToggles(transactionFilters);
    const selected = transactionFilters.querySelectorAll('input[name="platform"]:checked').length;
    const count = transactionFilters.querySelector<HTMLElement>('.platform-filter [data-filter-count]');
    if (count) count.textContent = selected ? `${selected} selected` : 'All';
  });
  syncGroupToggles(transactionFilters);
  syncSelectAllToggles(transactionFilters);
}

on('submit', 'form[data-confirm]', (el, event) => {
  if (!confirm(el.dataset.confirm)) event.preventDefault();
});

on('change', '[data-toggle-class]', el => {
  const target = document.querySelector(el.dataset.target ?? '');
  target?.classList.toggle(el.dataset.toggleClass ?? '', (el as HTMLInputElement).checked);
});

on('input', '[data-filter]', el => {
  const container = document.querySelector(el.dataset.filter ?? '');
  if (!container) return;
  const terms = (el as HTMLInputElement).value.toLowerCase().split(/\s+/).filter(Boolean);
  container.querySelectorAll<HTMLElement>('[data-search]').forEach(row => {
    const text = row.dataset.search ?? '';
    row.hidden = !terms.every(term => text.includes(term));
  });
  container.querySelectorAll<HTMLElement>('[data-group]').forEach(group => {
    group.hidden = !group.querySelector('[data-search]:not([hidden])');
  });
});

on('change', '[data-parent-option]', el => {
  const dropdown = el.closest<HTMLDetailsElement>('[data-parent-dropdown]');
  if (!dropdown) return;
  const label = dropdown.querySelector<HTMLElement>('[data-parent-selection]');
  if (label) label.textContent = el.dataset.parentName ?? 'No parent';
  dropdown.open = false;
  const search = dropdown.querySelector<HTMLInputElement>('input[type="search"]');
  if (search && search.value) {
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
  }
});

const editCreditNote = (form: HTMLFormElement, editing: boolean): void => {
  const display = form.querySelector<HTMLElement>('[data-credit-note-display]');
  const editor = form.querySelector<HTMLElement>('[data-credit-note-editor]');
  const notes = form.querySelector<HTMLInputElement>('input[name="notes"]');
  if (!display || !editor || !notes) return;
  display.hidden = editing;
  editor.hidden = !editing;
  notes.disabled = !editing;
  if (editing) notes.focus();
};

on('click', '[data-action="edit-credit-note"]', el => {
  const form = el.closest<HTMLFormElement>('form[data-creator-credit]');
  if (form) editCreditNote(form, true);
});

on('click', '[data-action="cancel-credit-note"]', el => {
  const form = el.closest<HTMLFormElement>('form[data-creator-credit]');
  if (!form) return;
  const notes = form.querySelector<HTMLInputElement>('input[name="notes"]');
  if (notes) notes.value = notes.defaultValue;
  editCreditNote(form, false);
  form.querySelector<HTMLElement>('[data-creator-credit-status]')!.textContent = '';
});

on('click', '[data-action="save-credit-note"]', el => {
  const form = el.closest<HTMLFormElement>('form[data-creator-credit]');
  if (!form) return;
  form.dataset.saveNotes = 'true';
  form.requestSubmit();
});

on('change', 'form[data-creator-credit] input[name="credited"]', el => {
  const form = (el as HTMLInputElement).form;
  if (!form) return;
  form.dataset.saveNotes = 'false';
  form.requestSubmit();
});

on('submit', 'form[data-creator-credit]', (el, event) => {
  event.preventDefault();
  const form = el as HTMLFormElement;
  if (form.dataset.saving) return;
  const editor = form.querySelector<HTMLElement>('[data-credit-note-editor]');
  const savingNote = form.dataset.saveNotes === 'true' || form.dataset.saveNotes === undefined && editor?.hidden === false;
  delete form.dataset.saveNotes;
  form.dataset.saving = '1';
  const checkbox = form.querySelector<HTMLInputElement>('input[name="credited"]')!;
  const notes = form.querySelector<HTMLInputElement>('input[name="notes"]');
  const buttons = form.querySelectorAll<HTMLButtonElement>('[data-action="save-credit-note"], [data-action="cancel-credit-note"]');
  const status = form.querySelector<HTMLElement>('[data-creator-credit-status]')!;
  const body = new FormData(form);
  if (!savingNote) body.delete('notes');
  checkbox.disabled = true;
  if (notes) notes.disabled = true;
  buttons.forEach(button => { button.disabled = true; });
  status.textContent = savingNote ? 'Saving note…' : 'Saving credit…';
  void fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body })
    .then(async response => {
      const data = await response.json() as { ok?: boolean; error?: string; link?: { notes?: string } };
      if (!response.ok || data.ok !== true) throw new Error(data.error ?? `Could not save attribution (HTTP ${response.status})`);
      checkbox.defaultChecked = checkbox.checked;
      if (savingNote && notes) {
        if (!data.link || data.link.notes !== undefined && typeof data.link.notes !== 'string') {
          throw new Error('Invalid attribution note response.');
        }
        notes.value = data.link.notes ?? '';
        notes.defaultValue = notes.value;
        form.querySelector<HTMLElement>('[data-credit-note-text]')!.textContent = notes.value || 'No note';
        editCreditNote(form, false);
      }
      form.closest('li')?.classList.toggle('creator-game-miscredited', !checkbox.checked);
      status.textContent = savingNote ? 'Note saved.' : 'Credit saved.';
    })
    .catch(error => {
      if (!savingNote) checkbox.checked = checkbox.defaultChecked;
      console.error('Could not save creator attribution:', error);
      status.textContent = `Could not save: ${error instanceof Error ? error.message : String(error)}`;
    })
    .finally(() => {
      checkbox.disabled = false;
      if (notes) notes.disabled = editor?.hasAttribute('hidden') ?? true;
      buttons.forEach(button => { button.disabled = false; });
      delete form.dataset.saving;
    });
});

document.querySelectorAll<HTMLElement>('[data-refresh-orchestrator]').forEach(initRefreshOrchestrator);
document.querySelectorAll<HTMLDetailsElement>('[data-refresh-queue]').forEach(initRefreshQueue);
document.querySelectorAll<HTMLButtonElement>('[data-refresh-game]').forEach(initGameRefreshButton);
document.querySelectorAll<HTMLFormElement>('[data-game-controls]').forEach(initGameList);
document.querySelectorAll<HTMLInputElement>('[data-personal-state-mode]').forEach(initPersonalStateMode);
if (document.querySelector('[data-popover]')) initPopovers();
document.querySelectorAll<HTMLDialogElement>('[data-personal-dialog]').forEach(initPersonalDialog);
