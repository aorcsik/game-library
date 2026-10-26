type Entry = { key: string; title: string };
type QueueStatus = { running: Entry | null; queued: Entry[] };

const gameLink = (entry: Entry): HTMLAnchorElement => {
  const link = document.createElement('a');
  link.href = `/games/${encodeURIComponent(entry.key)}`;
  link.textContent = entry.title;
  return link;
};

export const initRefreshQueue = (root: HTMLDetailsElement): void => {
  const count = root.querySelector<HTMLElement>('[data-refresh-queue-count]')!;
  const panel = root.querySelector<HTMLElement>('[data-refresh-queue-panel]')!;

  const update = async (): Promise<void> => {
    let delay = 10_000;
    try {
      const response = await fetch('/api/refresh-queue-status', { cache: 'no-store' });
      if (response.status === 204) {
        root.hidden = true;
        return;
      }
      if (!response.ok) throw new Error(`Queue status request failed (HTTP ${response.status})`);
      const { running, queued } = await response.json() as QueueStatus;
      root.hidden = false;
      count.textContent = String(queued.length + (running ? 1 : 0));
      panel.replaceChildren();
      if (running) {
        const heading = document.createElement('strong');
        heading.textContent = 'Refreshing';
        const current = document.createElement('p');
        current.append(gameLink(running));
        panel.append(heading, current);
      }
      if (queued.length) {
        const heading = document.createElement('strong');
        heading.textContent = `Queued (${queued.length})`;
        const list = document.createElement('ol');
        for (const entry of queued) {
          const item = document.createElement('li');
          item.append(gameLink(entry));
          list.append(item);
        }
        panel.append(heading, list);
      }
      if (!running && !queued.length) {
        const empty = document.createElement('p');
        empty.textContent = 'No game refreshes queued.';
        panel.append(empty);
      } else delay = 3_000;
    } catch (error) {
      console.error('Could not load refresh queue:', error);
      root.hidden = false;
      count.textContent = '!';
      panel.textContent = 'Could not load refresh queue.';
    }
    setTimeout(() => void update(), delay);
  };

  document.addEventListener('click', event => {
    if (!root.contains(event.target as Node)) root.open = false;
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') root.open = false;
  });
  void update();
};
