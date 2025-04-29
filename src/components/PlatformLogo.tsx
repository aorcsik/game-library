import Image from 'next/image';
import AmazonLogo from '../../public/images/amazon-logo.svg';
import AppStoreLogo from '../../public/images/appstore-logo.svg';
import EpicLogo from '../../public/images/epic-logo.svg';
import GOGLogo from '../../public/images/gog-logo.svg';
import PlayStationLogo from '../../public/images/playstation-logo.svg';
import SteamLogo from '../../public/images/steam-logo.svg';
import SwitchLogo from '../../public/images/switch-logo.svg';
import { PlatformLogos } from '../lib/types';
import { JSX } from 'react';

interface PlatformLogoProps {
  alt?: string;
  className?: string;
  platform: PlatformLogos;
}

const PlatformLogo = ({ platform, alt, className }: PlatformLogoProps): JSX.Element => {
  if (platform === 'psplus') {
    return <Image src="/images/psplus-logo.svg" width={24} height={24} alt={alt || 'PlayStation Plus'} className={className} unoptimized={true} />;
  }
  if (platform === 'netflix') {
    return <Image src="/images/netflix-logo.svg" width={24} height={24} alt={alt || 'Netflix Gaming'} className={className} unoptimized={true} />;
  }
  if (platform === 'amazon') {
    return <AmazonLogo aria-label={alt || 'Amazon Prime Gaming'} className={className} />;
  }
  if (platform === 'appstore') {
    return <AppStoreLogo aria-label={alt || 'Apple App Store'} className={className} />;
  }
  if (platform === 'epic') {
    return <EpicLogo aria-label={alt || 'Epic Games'} className={className} />;
  }
  if (platform === 'gog') {
    return <GOGLogo aria-label={alt || 'Good Old Games'} className={className} />;
  }
  if (platform === 'playstation') {
    return <PlayStationLogo aria-label={alt || 'PlayStation'} className={className} />;
  }
  if (platform === 'steam') {
    return <SteamLogo aria-label={alt || 'Steam'} className={className} />;
  }
  if (platform === 'switch') {
    return <SwitchLogo aria-label={alt || 'Nintendo Switch'} className={className} />;
  }
  return null;
};


export default PlatformLogo;
