import { raw } from 'hono/html';
import type { Child, JSX } from 'hono/jsx';

const NavLinks = () => (
  <>
    <a href="/transactions">Transactions</a>
    <a href="/transactions/new">New transaction</a>
    <a href="/games">Games</a>
    <a href="/creators">Creators</a>
    <a href="/posts">Posts</a>
    <a href="/media">Media</a>
    <a href="/refresh">Refresh ratings</a>
    <a href="/export.json">Export JSON</a>
  </>
);

export const Layout = ({ title, children }: { title: string; children?: Child }) => (
  <>
    {raw('<!DOCTYPE html>')}
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} · Game Library Admin</title>
        <link rel="stylesheet" href="/assets/fontawesome/css/all.min.css" />
        <link rel="stylesheet" href="/assets/admin.css" />
        <script type="module" src="/assets/admin.js"></script>
      </head>
      <body>
        <header class="topbar">
          <strong>Game Library</strong>
          <div class="topbar-actions">
            <nav class="topbar-links" aria-label="Main navigation"><NavLinks /></nav>
            <details class="refresh-queue" data-refresh-queue hidden>
              <summary>Refresh queue <span data-refresh-queue-count>0</span></summary>
              <div class="refresh-queue-panel" data-refresh-queue-panel>
                <p>Loading queue…</p>
              </div>
            </details>
            <details class="topbar-menu">
              <summary aria-label="Menu" title="Menu"><span aria-hidden="true">☰</span></summary>
              <nav aria-label="Mobile navigation"><NavLinks /></nav>
            </details>
          </div>
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

export const Select = (props: JSX.IntrinsicElements['select']) => (
  <span class="select-wrap">
    <select {...props} />
    <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
  </span>
);
