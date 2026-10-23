import { useState, useEffect } from 'react';

export interface WindowWidthState {
  width: number;
  isWideDesktop: boolean;
  isLaptop: boolean;
  isTablet: boolean;
  isMobile: boolean;
  isDrawerMode: boolean;
}

export function useWindowWidth(): WindowWidthState {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return 1440;
  });

  useEffect(() => {
    let timeoutId: any = null;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWidth(window.innerWidth);
      }, 50);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const isWideDesktop = width >= 1440;
  const isLaptop = width >= 1024 && width < 1440;
  const isTablet = width >= 768 && width < 1024;
  const isMobile = width < 768;
  const isDrawerMode = width < 1440;

  return {
    width,
    isWideDesktop,
    isLaptop,
    isTablet,
    isMobile,
    isDrawerMode,
  };
}
