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
type RefreshStatus = {
  state: 'pending' | 'running' | 'done' | 'failed';
  result?: RefreshResponse;
  error?: string;
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

const refreshMessage = (data: RefreshResponse): string => {
  const summary = SOURCES.map(s => `${s}: ${data.sources[s].status}${data.sources[s].error ? ` (${data.sources[s].error})` : ''}`).join(', ');
  const hasErrors = SOURCES.some(s => data.sources[s].status === 'error');
  return `${hasErrors ? 'Refresh finished with errors' : data.changed ? 'Updated' : 'Refresh complete (no changes)'}. ${summary}${data.proposed.metacritic ? `. Steam suggests ${data.proposed.metacritic}` : ''}`;
};

const pollRefresh = async (key: string, id: string, onProgress?: (state: 'pending' | 'running') => void): Promise<RefreshResponse | undefined> => {
  while (true) {
    const response = await fetch(`${API}/games/${key}/refresh/${id}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Refresh status failed (HTTP ${response.status})`);
    const job = await response.json() as RefreshStatus;
    if (job.state === 'failed') throw new Error(job.error ?? 'Refresh failed');
    if (job.state === 'done') return job.result;
    if (job.state !== 'pending' && job.state !== 'running') throw new Error('Unknown refresh job state');
    onProgress?.(job.state);
    await sleep(1000);
  }
};

const requestRefresh = async (key: string, query: string): Promise<RefreshResponse> => {
  const { status, data } = await post<{ id?: string; error?: string }>(`${API}/games/${key}/refresh?${query}`);
  if (status !== 202 || !data.id) throw new Error(data.error ?? `Refresh request failed (HTTP ${status})`);
  const result = await pollRefresh(key, data.id);
  if (!result) throw new Error('Refresh completed without a result');
  return result;
};

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
      let data: RefreshResponse;
      try {
        data = await requestRefresh(entry.key, params.toString());
      } catch (error) {
        logResult(entry, null, `failed: ${error instanceof Error ? error.message : String(error)}`);
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
  const status = document.querySelector<HTMLElement>('[data-refresh-status]');
  button.addEventListener('click', async () => {
    button.disabled = true;
    if (status) status.textContent = 'Queued for refresh…';
    let data: RefreshResponse;
    try {
      data = await requestRefresh(button.dataset.refreshGame!, 'force=1');
    } catch (error) {
      if (status) status.textContent = `Failed: ${error instanceof Error ? error.message : String(error)}`;
      button.disabled = false;
      return;
    }
    sessionStorage.setItem('refresh-status', refreshMessage(data));
    location.reload();
  });
  const previous = sessionStorage.getItem('refresh-status');
  if (previous && status) {
    status.textContent = previous;
    sessionStorage.removeItem('refresh-status');
  }

  const id = status?.dataset.autoRefreshId;
  if (!id || !status) return;
  const active = status.dataset.autoRefreshState === 'pending' || status.dataset.autoRefreshState === 'running';
  if (!active && previous) return;
  if (active) button.disabled = true;
  void pollRefresh(button.dataset.refreshGame!, id, state => {
    status.textContent = state === 'pending' ? 'Ratings refresh queued…' : 'Refreshing ratings in the background…';
  }).then(result => {
    const message = result ? refreshMessage(result) : 'Refresh no longer needed; ratings are up to date.';
    if (active && (!result || SOURCES.some(source => result.sources[source].status === 'fetched'))) {
      sessionStorage.setItem('refresh-status', message);
      location.reload();
    } else {
      status.textContent = message;
      button.disabled = false;
    }
  }).catch(error => {
    status.textContent = `Automatic refresh failed: ${error instanceof Error ? error.message : String(error)}`;
    button.disabled = false;
  });
};
