type Platform = 'steam' | 'epic' | 'gog' | 'amazon' | 'playstation' | 'appstore' | 'switch' | 'xbox';

type PlatformLogos = Platform | 'psplus' | 'netflix';

type PlatformList = Record<Platform, {
  name: string;
  count: number;
  plus?: number;
  netflix?: number;
}>;

export type { Platform, PlatformLogos, PlatformList };