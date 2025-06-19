'use client';

import { useState } from 'react';

type ToolTipProps = {
  text: string;
  align?: 'left' | 'right';
  style?: React.CSSProperties;
  className?: string;
  children: React.ReactNode;
};


const ToolTip = ({ text, align='left', style, className, children }: ToolTipProps): React.JSX.Element => {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  return (
    <div
      style={style ? style : {}}
      className={`tooltip-container ${className ? className : ''}`}
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
    >
      {children}
      {<div className={`tooltip ${tooltipVisible ? 'visible' : ''} align-${align}`}>
        <span className="tooltip-text">{text}</span>
      </div>}
    </div>
  );
};

export default ToolTip;