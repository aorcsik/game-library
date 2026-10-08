import { LEGACY_SYSTEM_LABELS, SUBSCRIPTION_LABELS } from '../model';

// Label -> icon file in /assets/platforms and an optional qualifier shown next to shared icons.
const ICONS: Record<string, { icon: string; suffix?: string }> = {
  'steam': { icon: 'steam' },
  'gog': { icon: 'gog' },
  'epic': { icon: 'epic' },
  'epic-mobile': { icon: 'epic-mobile' },
  'amazon': { icon: 'amazon-luna' },
  'ea': { icon: 'electronic-arts' },
  'origin': { icon: 'origin' },
  'legacy': { icon: 'legacy-games' },
  'windows': { icon: 'windows' },
  'macos': { icon: 'macos' },
  'linux': { icon: 'linux' },
  'android': { icon: 'android' },
  'appstore': { icon: 'appstore' },
  'apple-arcade': { icon: 'apple-arcade' },
  'netflix': { icon: 'netflix' },
  'playstation': { icon: 'playstation' },
  'playstation-plus': { icon: 'psplus' },
  'playstation-ps3': { icon: 'playstation', suffix: 'PS3' },
  'playstation-plus-ps3': { icon: 'psplus', suffix: 'PS3' },
  'switch': { icon: 'switch' },
  'xbox': { icon: 'xbox' },
};

export const PlatformIcon = ({ label, physical, withLabel, tooltip }: { label: string; physical?: boolean; withLabel?: boolean; tooltip?: string }) => {
  const entry = ICONS[label];
  const classes = [
    'platform',
    SUBSCRIPTION_LABELS.includes(label) && 'subscription',
    LEGACY_SYSTEM_LABELS.includes(label) && 'disabled',
    physical && 'physical',
  ].filter(Boolean).join(' ');
  const title = `${label}${physical ? ' (physical)' : ''}`;
  // Detailed tooltips use the custom popover (client/popover.ts); simple ones the native title.
  const hint = tooltip ? { 'data-popover': tooltip, tabindex: 0 } : { title };
  if (!entry) return <span class={`${classes} platform-text`} {...hint}>{label}</span>;
  return (
    <span class={classes} {...hint}>
      <i class={`platform-icon icon-${entry.icon}`} role="img" aria-label={label}></i>
      {entry.suffix && <small>{entry.suffix}</small>}
      {withLabel && <span class="platform-label">{label}</span>}
    </span>
  );
};

const STORE_LOGOS: Record<string, string> = {
  'Epic Games Store': 'epic',
  'Amazon Luna': 'amazon-luna',
  'Prime Gaming': 'amazon-prime',
  'Steam Store': 'steam-color',
  Kickstarter: 'kickstarter',
  GoG: 'gog',
  'GOG Store': 'gog',
  'Apple App Store': 'appstore-color',
  'Green Man Gaming': 'green-man-gaming',
  'Nintendo eShop': 'nintendo-eshop',
  'Playstation Store': 'playstation-store',
  'PlayStation Store': 'playstation-store',
  'Xbox Store': 'xbox',
  Fanatical: 'fanatical',
  'Humble Store': 'humble-store',
};

const MASKED_STORE_LOGOS = new Set(['amazon-luna', 'amazon-prime', 'epic', 'gog']);

export const StoreLogo = ({ store }: { store: string }) => {
  const logo = STORE_LOGOS[store];
  return logo
    ? MASKED_STORE_LOGOS.has(logo)
      ? <span class={`store-logo store-logo-mask icon-${logo}`} aria-hidden="true"></span>
      : <img class="store-logo" src={`/assets/platforms/${logo}.svg`} alt="" />
    : <i class="fa-solid fa-cart-shopping store-logo store-icon" aria-hidden="true"></i>;
};
