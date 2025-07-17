export type Platform = 'steam' | 'epic' | 'gog' | 'amazon' | 'playstation' | 'appstore' | 'switch' | 'xbox';

export const platformKeys: Platform[] = [
  'steam',
  'epic',
  'gog',
  'amazon',
  'playstation',
  'appstore',
  'switch',
  'xbox'
];

export const isValidPlatform = (platform: string): platform is Platform => {
  return platformKeys.includes(platform as Platform);
};

export type PlatformLogos = Platform | 'psplus' | 'netflix';

export type PlatformList = Record<Platform, {
  name: string;
  count: number;
  plus?: number;
  netflix?: number;
}>;
