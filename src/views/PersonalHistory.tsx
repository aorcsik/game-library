import {
  PERSONAL_RATINGS, PERSONAL_PLATFORMS, PROGRESS_STATES,
  type PersonalEntry, type PersonalSummary, type ProgressMark,
} from '../personal';
import type { PersonalDraft } from '../personalStore';
import { PlatformIcon } from './PlatformIcon';

const stateInfo = (key: string) => PROGRESS_STATES.find(state => state.key === key);
const ratingInfo = (value: number) => PERSONAL_RATINGS.find(rating => rating.value === value);
const StateIcon = ({ icon }: { icon: string }) => <i class={`personal-state-icon icon-${icon}`} aria-hidden="true"></i>;

export const ProgressBadge = ({ mark, kind }: { mark: ProgressMark; kind: 'latest' | 'peak' }) => {
  const info = stateInfo(mark.state)!;
  return (
    <span data-state-kind={kind} class={`personal-badge progress-${info.tone}`} title={`${kind === 'latest' ? 'Most recent' : 'Highest achieved'}: ${info.label} · ${mark.date} · ${mark.platform}`}>
      <StateIcon icon={info.icon} />
      <span>{info.label}</span>
    </span>
  );
};

export const RatingBadge = ({ rating, date, platform }: { rating: number; date?: string; platform?: string }) => {
  const info = ratingInfo(rating)!;
  return (
    <span class={`personal-badge ${info.tone}`} title={`Most recent rating: ${info.label}${date ? ` · ${date}` : ''}${platform ? ` · ${platform}` : ''}`}>
      <i class={`personal-rating-icon icon-${info.icon}`} aria-hidden="true"></i>
      <span>{info.label}</span>
    </span>
  );
};

export const PersonalSummaryView = ({ summary }: { summary?: PersonalSummary }) => {
  if (!summary) return <span class="meta">—</span>;
  return (
    <div class="personal-summary">
      {summary.latest && <ProgressBadge mark={summary.latest} kind="latest" />}
      {summary.peak && <ProgressBadge mark={summary.peak} kind="peak" />}
      {summary.rating && <RatingBadge rating={summary.rating.rating} date={summary.rating.date} platform={summary.rating.platform} />}
      {!summary.latest && !summary.rating && <span class="meta">{summary.entries} notes</span>}
    </div>
  );
};

export const PersonalHistory = ({ gameKey, entries, errors = [], saved, draft, today, editingEntry }: {
  gameKey: string;
  entries: PersonalEntry[];
  errors?: string[];
  saved?: boolean;
  draft: PersonalDraft;
  today: string;
  editingEntry?: PersonalEntry;
}) => (
  <section class="personal-history">
    <h2>Personal states <small>{entries.length} entries</small></h2>
    {saved && <p class="notice">Personal entry saved.</p>}
    {errors.length > 0 && <ul class="errors">{errors.map(error => <li>{error}</li>)}</ul>}
    <button type="button" data-action="add-personal" data-target="#personal-entry-dialog">Add personal entry</button>
    <dialog
      id="personal-entry-dialog"
      class="personal-dialog"
      data-personal-dialog
      data-open={errors.length || editingEntry ? 'true' : undefined}
      data-create-action={`/games/${gameKey}/state`}
      data-today={today}
    >
      <form id="personal-state-form" method="post" action={`/games/${gameKey}/state${editingEntry ? `/${editingEntry.id}` : ''}`} class="tx-form personal-form">
        <div class="dialog-heading">
          <h2 data-personal-dialog-title>{editingEntry ? `Edit entry from ${editingEntry.date}` : 'Add personal entry'}</h2>
          <button type="button" data-action="close-personal" aria-label="Close dialog">×</button>
        </div>
        <div class="row">
          <label>Date<input type="date" name="date" data-personal-field="date" value={draft.date || today} required /></label>
          <label>Platform<select name="platform" data-personal-field="platform" required>
            <option value="">Choose platform</option>
            {PERSONAL_PLATFORMS.map(platform => <option value={platform} selected={draft.platform === platform}>{platform}</option>)}
          </select></label>
          <label>Progress state<select name="state" data-personal-field="state">
            <option value="">No progress update</option>
            {PROGRESS_STATES.map(state => <option value={state.key} selected={draft.state === state.key}>{state.label}</option>)}
          </select></label>
          <label>Rating<select name="rating" data-personal-field="rating">
            <option value="">No rating update</option>
            {PERSONAL_RATINGS.map(rating => <option value={rating.value} selected={draft.rating === String(rating.value)}>{rating.label}</option>)}
          </select></label>
        </div>
        <label>Note<textarea name="note" data-personal-field="note" rows={3} maxlength={4000}>{draft.note}</textarea></label>
        <div class="actions">
          <button type="submit" class="primary" data-personal-submit>{editingEntry ? 'Save changes' : 'Add entry'}</button>
          <button type="button" data-action="close-personal">Cancel</button>
        </div>
      </form>
    </dialog>
    {entries.length > 0 && (
      <table class="list personal-entry-list">
        <thead><tr><th>Date</th><th>Platform</th><th>Progress</th><th>Rating</th><th>Note</th><th></th></tr></thead>
        <tbody>
          {[...entries].sort((a, b) => b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt)).map(entry => {
            const state = entry.state ? stateInfo(entry.state) : undefined;
            const rating = entry.rating !== undefined ? ratingInfo(entry.rating) : undefined;
            return (
              <tr>
                <td class="date">{entry.date}</td>
                <td><PlatformIcon label={entry.platform} withLabel /></td>
                <td>{state && <span class={`personal-badge progress-${state.tone}`}><StateIcon icon={state.icon} />{state.label}</span>}</td>
                <td>{rating && <RatingBadge rating={rating.value} />}</td>
                <td class="personal-note">{entry.note ?? ''}</td>
                <td class="num entry-actions">
                  <button
                    type="button"
                    data-action="edit-personal"
                    data-target="#personal-entry-dialog"
                    data-entry-id={entry.id}
                    data-entry-date={entry.date}
                    data-entry-platform={entry.platform}
                    data-entry-state={entry.state ?? ''}
                    data-entry-rating={entry.rating === undefined ? '' : String(entry.rating)}
                    data-entry-note={entry.note ?? ''}
                  >Edit</button>
                  <form method="post" action={`/games/${gameKey}/state/${entry.id}/delete`}>
                    <button type="submit" class="danger" aria-label={`Delete entry from ${entry.date}`} title="Delete entry">Delete</button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    )}
  </section>
);
