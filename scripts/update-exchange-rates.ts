import { writeFile } from 'node:fs/promises';
import { DOMParser } from 'linkedom';

const url = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml';
const response = await fetch(url);
if (!response.ok) throw new Error(`ECB rates: ${response.status} ${response.statusText}`);

const document = new DOMParser().parseFromString(await response.text(), 'text/xml');
const rates: Record<string, [number, number, number]> = {};
for (const day of document.querySelectorAll('Cube[time]')) {
  const date = day.getAttribute('time');
  if (!date || date < '2008-01-01') continue;
  const values = Object.fromEntries(
    [...day.querySelectorAll('Cube[currency]')].map(currency => [currency.getAttribute('currency'), Number(currency.getAttribute('rate'))]),
  );
  if (values.HUF && values.USD && values.GBP) rates[date] = [values.HUF, values.USD, values.GBP];
}
if (!Object.keys(rates).length) throw new Error('No historical ECB exchange rates found');

await writeFile(new URL('../src/exchange-rates.json', import.meta.url), JSON.stringify(rates));
console.log(`Saved ${Object.keys(rates).length} daily ECB rates`);