// Progressive enhancement for the public blog: let clamped game descriptions expand.
const enhance = (description: HTMLElement): void => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'game-card-more';
  button.textContent = 'Show more';
  button.setAttribute('aria-expanded', 'false');
  button.hidden = true;
  description.after(button);

  // Only a collapsed description can be measured; once expanded the button stays so it can be collapsed again.
  const update = (): void => {
    if (!description.classList.contains('expanded')) button.hidden = description.scrollHeight <= description.clientHeight + 1;
  };

  button.addEventListener('click', () => {
    const expanded = description.classList.toggle('expanded');
    button.textContent = expanded ? 'Show less' : 'Show more';
    button.setAttribute('aria-expanded', String(expanded));
    if (!expanded) update();
  });

  // The width changes with the viewport and once the cover image loads, which changes how many lines are needed.
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(update).observe(description);
  update();
};

document.querySelectorAll<HTMLElement>('[data-card-description]').forEach(enhance);
