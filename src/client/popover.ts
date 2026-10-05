/** Shared popover for elements with data-popover="Title\nline\nline"; replaces the native title tooltip. */
export const initPopovers = (): void => {
  const popover = document.createElement('div');
  popover.className = 'popover';
  popover.setAttribute('role', 'tooltip');
  popover.hidden = true;
  const heading = document.createElement('strong');
  const list = document.createElement('ul');
  const arrow = document.createElement('span');
  arrow.className = 'popover-arrow';
  popover.append(heading, list, arrow);
  document.body.append(popover);

  let current: HTMLElement | null = null;
  const GAP = 10;
  const MARGIN = 8;

  const hide = (): void => {
    popover.hidden = true;
    current = null;
  };

  const show = (el: HTMLElement): void => {
    if (current === el) return;
    current = el;
    const [title = '', ...lines] = (el.dataset.popover ?? '').split('\n');
    heading.textContent = title;
    list.replaceChildren(...lines.map(line => {
      const li = document.createElement('li');
      li.textContent = line;
      return li;
    }));
    list.hidden = lines.length === 0;
    popover.hidden = false;

    const rect = el.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = popover;
    const below = rect.top - height - GAP < MARGIN;
    const center = rect.left + rect.width / 2;
    const left = Math.min(Math.max(center - width / 2, MARGIN), document.documentElement.clientWidth - width - MARGIN);
    const top = below ? rect.bottom + GAP : rect.top - height - GAP;
    popover.classList.toggle('below', below);
    popover.style.left = `${left + scrollX}px`;
    popover.style.top = `${top + scrollY}px`;
    arrow.style.left = `${Math.min(Math.max(center - left, 12), width - 12)}px`;
  };

  const target = (event: Event): HTMLElement | null =>
    (event.target as Element | null)?.closest<HTMLElement>('[data-popover]') ?? null;

  document.addEventListener('mouseover', event => {
    const el = target(event);
    if (el) show(el);
  });
  document.addEventListener('mouseout', event => {
    const el = target(event);
    if (el && !el.contains(event.relatedTarget as Node | null)) hide();
  });
  document.addEventListener('focusin', event => {
    const el = target(event);
    if (el) show(el);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  addEventListener('scroll', hide, { passive: true });
};
