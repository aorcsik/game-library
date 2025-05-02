import { JSX, HTMLAttributes } from 'react';

type FontAwesomeIconProps = {
  icon: [prefix: string, iconName: string];
  className?: string;
} & HTMLAttributes<HTMLElement>;

export default function FontAwesomeIcon({ 
  icon, 
  className = '', 
  ...props 
}: FontAwesomeIconProps): JSX.Element {
  const [prefix, iconName] = icon;
  let iconPreefix = 'fa-regular';
  if (prefix === 'fas') {
    iconPreefix = 'fa-solid';
  } else if (prefix === 'fab') {
    iconPreefix = 'fa-brands';
  } else if (prefix === 'far') {
    iconPreefix = 'fa-regular';
  } else if (prefix === 'fal') {
    iconPreefix = 'fa-light';
  } else if (prefix === 'fad') {
    iconPreefix = 'fa-duotone';
  }
  const iconClass = `${iconPreefix} fa-${iconName.toLowerCase()}`;
  
  return (
    <i data-prefix={prefix} className={`${iconClass} ${className}`.trim()} {...props}>
      {props['aria-label'] ? <span className="sr-only">{props['aria-label']}</span> : null}
    </i>
  );
}