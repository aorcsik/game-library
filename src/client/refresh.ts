type SourceName = 'steam' | 'opencritic' | 'metacritic';
const SOURCES: SourceName[] = ['steam', 'opencritic', 'metacritic'];

type QueueEntry = { key: string; title: string; reason: string };
type RefreshResponse = {
  key: string;
  title: string;
  changed: boolean;
  sources: Record<SourceName, { status: string; error?: string }>;
  missing: SourceName[];
  needsReleaseDate: boolean;
  proposed: { metacritic?: string };
};

const API = '/api/fetcher';

const post = async <T>(url: string, body?: FormData): Promise<{ status: number; data: T }> => {
  const response = await fetch(url, { method: 'POST', body });
  return { status: response.status, data: await response.json() as T };
};

const searchUrl = (source: SourceName, title: string): string => {
  const q = encodeURIComponent(title);
  if (source === 'steam') return `https://store.steampowered.com/search/?term=${q}`;
  if (source === 'metacritic') return `https://www.metacritic.com/search/${q}/`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(`${title} site:opencritic.com/game`)}`;
};

/** Accepts ids or pasted page URLs. */
const normalizeInput = (source: SourceName, value: string): string => {
  const v = value.trim();
  if (source === 'steam') return v.match(/store\.steampowered\.com\/app\/(\d+)/)?.[1] ?? v;
  if (source === 'opencritic') return v.match(/opencritic\.com\/game\/(\d+\/[\w-]+)/)?.[1] ?? v;
  return v.replace(/^https?:\/\/(www\.)?metacritic\.com\//, 'https://www.metacritic.com/').replace(/[?#].*$/, '');
};

const cell = (text: string, className = ''): HTMLTableCellElement => {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  return td;
};

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export const initRefreshOrchestrator = (root: HTMLElement): void => {
  const options = root.querySelector<HTMLFormElement>('[data-refresh-options]')!;
  const progress = root.querySelector<HTMLElement>('[data-refresh-progress]')!;
  const prompt = root.querySelector<HTMLFormElement>('[data-refresh-prompt]')!;
  const log = root.querySelector<HTMLElement>('[data-refresh-log]')!;
  const button = (action: string): HTMLButtonElement => root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;

  let running = false;
  let paused = false;
  let stopped = false;
  let resume: (() => void) | null = null;

  const setRunning = (value: boolean): void => {
    running = value;
    button('start').disabled = value;
    button('pause').disabled = !value;
    button('stop').disabled = !value;
    button('pause').textContent = 'Pause';
  };

  button('pause').addEventListener('click', () => {
    paused = !paused;
    button('pause').textContent = paused ? 'Resume' : 'Pause';
    if (!paused) resume?.();
  });
  button('stop').addEventListener('click', () => {
    stopped = true;
    paused = false;
    resume?.();
  });

  const logResult = (entry: QueueEntry, result: RefreshResponse | null, note: string): void => {
    const tr = document.createElement('tr');
    const link = document.createElement('a');
    link.href = `/games/${entry.key}`;
    link.textContent = entry.title;
    const first = document.createElement('td');
    first.append(link);
    tr.append(first);
    for (const source of SOURCES) {
      const s = result?.sources[source];
      const td = cell(s ? s.status : '', s?.status === 'error' || s?.status === 'missing' ? 'missing' : '');
      if (s?.error) td.title = s.error;
      tr.append(td);
    }
    tr.append(cell(note));
    log.prepend(tr);
  };

  /** Resolves with true when the user saved new references, false when skipped (or stopped). */
  const askForReferences = (entry: QueueEntry, result: RefreshResponse): Promise<boolean> => new Promise(done => {
    prompt.hidden = false;
    prompt.reset();
    prompt.querySelector('[data-prompt-title]')!.textContent = entry.title;
    prompt.querySelector<HTMLAnchorElement>('[data-prompt-link]')!.href = `/games/${entry.key}`;
    const errors = prompt.querySelector<HTMLElement>('[data-prompt-errors]')!;
    errors.hidden = true;
    for (const source of SOURCES) {
      const missing = result.missing.includes(source);
      prompt.querySelector<HTMLElement>(`[data-prompt-source="${source}"]`)!.hidden = !missing;
      prompt.querySelector<HTMLAnchorElement>(`[data-prompt-search="${source}"]`)!.href = searchUrl(source, entry.title);
    }
    if (result.proposed.metacritic) prompt.querySelector<HTMLInputElement>('input[name="metacritic"]')!.value = result.proposed.metacritic;
    prompt.querySelector<HTMLElement>('[data-prompt-release]')!.hidden = result.missing.length > 0 || !result.needsReleaseDate;
    prompt.querySelector<HTMLInputElement>(result.missing.length ? `input[name="${result.missing[0]}"]` : 'input[name="releaseDate"]')?.focus();

    const finish = (saved: boolean): void => {
      prompt.hidden = true;
      prompt.onsubmit = null;
      button('skip').onclick = null;
      resume = null;
      done(saved);
    };
    resume = () => { if (stopped) finish(false); };
    button('skip').onclick = () => finish(false);
    prompt.onsubmit = async event => {
      event.preventDefault();
      const body = new FormData();
      for (const source of result.missing) {
        body.set(source, normalizeInput(source, prompt.querySelector<HTMLInputElement>(`input[name="${source}"]`)!.value));
      }
      const releaseDate = prompt.querySelector<HTMLInputElement>('input[name="releaseDate"]')!.value;
      if (releaseDate) body.set('releaseDate', releaseDate);
      const { status, data } = await post<{ errors?: string[] }>(`${API}/games/${entry.key}/sources`, body);
      if (status !== 200) {
        errors.textContent = (data.errors ?? ['Saving failed']).join(' ');
        errors.hidden = false;
        return;
      }
      finish(true);
    };
  });

  const run = async (): Promise<void> => {
    const params = new URLSearchParams({
      maxAge: (options.elements.namedItem('maxAge') as HTMLInputElement).value,
      scope: (options.elements.namedItem('scope') as HTMLSelectElement).value,
    });
    const delay = Number((options.elements.namedItem('delay') as HTMLInputElement).value) || 0;
    stopped = false;
    paused = false;
    setRunning(true);
    progress.textContent = 'Loading queue…';
    const { queue, total } = await (await fetch(`${API}/queue?${params}`)).json() as { queue: QueueEntry[]; total: number };
    let changed = 0;

    for (let i = 0; i < queue.length && !stopped; i++) {
      if (paused) await new Promise<void>(r => { resume = r; });
      if (stopped) break;
      const entry = queue[i];
      progress.textContent = `${i + 1} / ${queue.length} (of ${total} games): ${entry.title} (${entry.reason}), ${changed} changed`;
      const { status, data } = await post<RefreshResponse>(`${API}/games/${entry.key}/refresh?${params}`);
      if (status !== 200) {
        logResult(entry, null, `failed (HTTP ${status})`);
        continue;
      }
      if (data.changed) changed++;
      if (data.missing.length || data.needsReleaseDate) {
        logResult(entry, data, 'needs input');
        if (await askForReferences(entry, data)) i--;
        continue;
      }
      const errors = SOURCES.filter(s => data.sources[s].status === 'error');
      logResult(entry, data, errors.length ? `errors: ${errors.join(', ')}` : data.changed ? 'updated' : 'unchanged');
      if (delay) await sleep(delay);
    }
    progress.textContent = `${stopped ? 'Stopped' : 'Done'}: ${changed} games changed. Publish with \`npm run publish:games\`.`;
    setRunning(false);
  };

  button('start').addEventListener('click', () => {
    if (!running) run().catch(error => {
      progress.textContent = `Failed: ${error instanceof Error ? error.message : String(error)}`;
      setRunning(false);
    });
  });
};

export const initGameRefreshButton = (button: HTMLButtonElement): void => {
  button.addEventListener('click', async () => {
    const status = document.querySelector<HTMLElement>('[data-refresh-status]');
    button.disabled = true;
    if (status) status.textContent = 'Fetching…';
    const { status: code, data } = await post<RefreshResponse>(`${API}/games/${button.dataset.refreshGame}/refresh?force=1`);
    if (code !== 200) {
      if (status) status.textContent = `Failed (HTTP ${code})`;
      button.disabled = false;
      return;
    }
    const summary = SOURCES.map(s => `${s}: ${data.sources[s].status}${data.sources[s].error ? ` (${data.sources[s].error})` : ''}`).join(', ');
    sessionStorage.setItem('refresh-status', `${data.changed ? 'Updated' : 'No changes'}. ${summary}${data.proposed.metacritic ? `. Steam suggests ${data.proposed.metacritic}` : ''}`);
    location.reload();
  });
  const previous = sessionStorage.getItem('refresh-status');
  const status = document.querySelector<HTMLElement>('[data-refresh-status]');
  if (previous && status) {
    status.textContent = previous;
    sessionStorage.removeItem('refresh-status');
  }
};
