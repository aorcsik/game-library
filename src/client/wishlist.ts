const BATCH_DELAY_MS = 1500;
const RETRY_DELAY_MS = 10_000;

type TitleBatch = { resolved: number; pending: number; error?: string };

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** While titles are pending, resolves them in server-side batches, then reloads to show them. */
export const initWishlistTitles = async (): Promise<void> => {
  const status = document.querySelector<HTMLElement>('[data-wishlist-pending]');
  if (!status) return;
  let failures = 0;
  while (failures < 3) {
    try {
      const response = await fetch('/wishlist/titles', { method: 'POST' });
      if (!response.ok) throw new Error(`Title lookup failed (${response.status}).`);
      const batch = await response.json() as TitleBatch;
      if (batch.error) throw new Error(batch.error);
      failures = 0;
      if (batch.pending <= 0) {
        location.reload();
        return;
      }
      status.textContent = `Fetching ${batch.pending} titles…`;
      await sleep(BATCH_DELAY_MS);
    } catch {
      failures++;
      status.textContent = 'Title lookup is being rate limited; retrying…';
      await sleep(RETRY_DELAY_MS);
    }
  }
  status.textContent = 'Title lookup failed. Reload the page to try again.';
};
