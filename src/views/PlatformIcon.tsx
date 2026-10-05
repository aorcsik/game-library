import { LEGACY_SYSTEM_LABELS, SUBSCRIPTION_LABELS } from '../model';

// Label -> icon file in /assets/platforms and an optional qualifier shown next to shared icons.
const ICONS: Record<string, { icon: string; suffix?: string }> = {
  'steam': { icon: 'steam' },
  'gog': { icon: 'gog' },
  'epic': { icon: 'epic' },
  'epic-mobile': { icon: 'epic-mobile' },
  'amazon': { icon: 'amazon-luna' },
  'ea': { icon: 'electronic-arts' },
  'origin': { icon: 'electronic-arts' },
  'legacy': { icon: 'legacy-games' },
  'windows': { icon: 'windows' },
  'appstore': { icon: 'appstore' },
  'apple-arcade': { icon: 'appstore', suffix: 'arcade' },
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
