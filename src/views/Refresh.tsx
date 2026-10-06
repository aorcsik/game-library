import { Layout, Select } from './Layout';

const SOURCE_FIELDS = [
  { name: 'steam', label: 'Steam app id or store URL', placeholder: '242820' },
  { name: 'opencritic', label: 'OpenCritic id or URL', placeholder: '3245/140' },
  { name: 'metacritic', label: 'Metacritic URL', placeholder: 'https://www.metacritic.com/game/…/' },
];

export const RefreshPage = () => (
  <Layout title="Refresh ratings">
    <h1>Refresh ratings <small>runs locally, writes to the local GAMEDB replica</small></h1>
    <div data-refresh-orchestrator>
      <form class="filters" data-refresh-options>
        <label>Refetch older than <input type="number" name="maxAge" value="14" min="0" max="3650" /> days</label>
        <Select name="scope">
          <option value="owned" selected>Owned games</option>
          <option value="all">All games</option>
        </Select>
        <label>Delay <input type="number" name="delay" value="500" min="0" max="10000" step="100" /> ms</label>
        <button type="button" class="primary" data-action="start">Load queue &amp; start</button>
        <button type="button" data-action="pause" disabled>Pause</button>
        <button type="button" data-action="stop" disabled>Stop</button>
      </form>
      <p data-refresh-progress class="meta">Idle.</p>

      <form class="item" data-refresh-prompt hidden>
        <div class="item-fields">
          <h2 data-prompt-title></h2>
          <p class="meta">Missing references. Paste an id or page URL, leave empty for "not on this source".</p>
          <div class="row">
            {SOURCE_FIELDS.map(f => (
              <label class="grow" data-prompt-source={f.name} hidden>
                {f.label} <a data-prompt-search={f.name} target="_blank" rel="noopener noreferrer">search</a>
                <input name={f.name} placeholder={f.placeholder} />
              </label>
            ))}
            <label data-prompt-release hidden>Release date<input type="date" name="releaseDate" /></label>
          </div>
          <p class="errors" data-prompt-errors hidden></p>
          <div class="actions">
            <button type="submit" class="primary">Save &amp; retry</button>
            <button type="button" data-action="skip">Skip game</button>
            <a data-prompt-link target="_blank">Open game page</a>
          </div>
        </div>
      </form>

      <table class="list">
        <thead>
          <tr><th>Game</th><th>Steam</th><th>OpenCritic</th><th>Metacritic</th><th>Result</th></tr>
        </thead>
        <tbody data-refresh-log></tbody>
      </table>
    </div>
  </Layout>
);
