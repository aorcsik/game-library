import { raw } from 'hono/html';
import type { Child } from 'hono/jsx';

export const Layout = ({ title, children }: { title: string; children?: Child }) => (
  <>
    {raw('<!DOCTYPE html>')}
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} · Game Library Admin</title>
        <link rel="stylesheet" href="/assets/admin.css" />
        <script type="module" src="/assets/admin.js"></script>
      </head>
      <body>
        <header class="topbar">
          <strong>Game Library</strong>
          <nav>
            <a href="/transactions">Transactions</a>
            <a href="/transactions/new">New transaction</a>
            <a href="/games">Games</a>
            <a href="/refresh">Refresh ratings</a>
            <a href="/library">Libraries</a>
            <a href="/export.json">Export JSON</a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  </>
);

export const Options = ({ values, selected, empty }: { values: readonly string[]; selected?: string; empty?: string }) => (
  <>
    {empty !== undefined && <option value="">{empty}</option>}
    {values.map(v => <option value={v} selected={v === selected}>{v}</option>)}
  </>
);
