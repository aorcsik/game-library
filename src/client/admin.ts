import { initGameList, initPersonalStateMode } from './games';
import { initPopovers } from './popover';
import { initPersonalDialog } from './personal';
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
  button.setAttribute('aria-label', expanded ? 'Hide items' : 'Show items');
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

on('input', '[data-cover-input]', el => {
  const input = el as HTMLInputElement;
  const img = input.closest('[data-item]')?.querySelector<HTMLImageElement>('[data-cover-preview]');
  if (!img) return;
  const valid = /^https?:\/\//.test(input.value);
  img.hidden = !valid;
  if (valid) img.src = input.value;
});

on('change', '[data-autosubmit]', el => {
  (el as HTMLSelectElement).form?.requestSubmit();
});

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

document.querySelectorAll<HTMLElement>('[data-refresh-orchestrator]').forEach(initRefreshOrchestrator);
document.querySelectorAll<HTMLButtonElement>('[data-refresh-game]').forEach(initGameRefreshButton);
document.querySelectorAll<HTMLFormElement>('[data-game-controls]').forEach(initGameList);
document.querySelectorAll<HTMLInputElement>('[data-personal-state-mode]').forEach(initPersonalStateMode);
if (document.querySelector('[data-popover]')) initPopovers();
document.querySelectorAll<HTMLDialogElement>('[data-personal-dialog]').forEach(initPersonalDialog);
