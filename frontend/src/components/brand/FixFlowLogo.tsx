import React from 'react';

interface FixFlowLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  theme?: 'dark' | 'light';
  showWordmark?: boolean;
}

export const FixFlowLogo: React.FC<FixFlowLogoProps> = ({
  className = '',
  size = 'md',
  theme = 'light',
  showWordmark = true,
}) => {
  const iconSize = size === 'sm' ? 24 : size === 'lg' ? 36 : 28;
  const textSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl';

  const isDarkBg = theme === 'dark';
  const pineColor = isDarkBg ? '#F6F4EE' : '#183B32';
  const brassColor = '#B49A68';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Abstract Architectural Doorway & Continuous F-Pathway Vector Mark */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-300 hover:scale-[1.03]"
        aria-hidden="true"
      >
        {/* Architectural Doorway / Portal Outline */}
        <path
          d="M6 27V5.5C6 4.67157 6.67157 4 7.5 4H21.5C22.3284 4 23 4.67157 23 5.5V27"
          stroke={pineColor}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Angled Door Panel forming structural F-contour */}
        <path
          d="M10 6.8L18 9V24.5L10 26.8V6.8Z"
          fill={isDarkBg ? 'rgba(255,255,255,0.06)' : 'rgba(24,59,50,0.07)'}
          stroke={pineColor}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />

        {/* Hardware Detail in Champagne Brass */}
        <circle cx="16.2" cy="16.8" r="1.1" fill={brassColor} />

        {/* Continuous Flow Pathway through the Portal (Fault to Fix Journey) */}
        <path
          d="M3 27C7 27 9.5 24.5 12 21.5C14.5 18.5 17 19 20 22C23 25 25.5 24 29 20"
          stroke={brassColor}
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* Resolution Node */}
        <circle cx="29" cy="20" r="1.6" fill={brassColor} />
      </svg>

      {/* Elegant FixFlow Wordmark */}
      {showWordmark && (
        <span
          className={`font-semibold tracking-tight ${textSize} ${
            isDarkBg ? 'text-[#F6F4EE]' : 'text-[#183B32]'
          } font-sans`}
          style={{ letterSpacing: '-0.028em' }}
        >
          FixFlow
        </span>
      )}
    </div>
  );
};
