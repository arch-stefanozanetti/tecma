// Da spostare su componente a parte
import React, { useState, useEffect, ReactNode, useMemo } from 'react';

import { BREAKPOINTS_DETAILED } from '../constants/breakpoints';

import type { Device } from '../declarations/device';

interface DeviceContextType {
  children?: ReactNode;
  forceDevice?: Device;
}
interface DeviceState {
  height?: number;
  width?: number;
}

export const setRealDeviceHeight = () => {
  const vh = window.innerHeight;
  document.documentElement.style.setProperty('--device-view-height', `${vh}px`);
};
export const Context = React.createContext({
  device: {} as DeviceState,
  forceDevice: undefined as Device | undefined,
});
export const DeviceContext: React.FC<DeviceContextType> = ({ children, forceDevice }) => {
  const [device, setDevice] = useState<DeviceState>({ height: 0, width: 0 });
  const handleResize = () => {
    setDevice({
      height: window.innerHeight,
      width: window.innerWidth,
    });
    setRealDeviceHeight();
  };

  const providerProps = useMemo(() => ({ device, forceDevice }), [device, forceDevice]);

  useEffect(() => {
    if (!forceDevice) {
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
    setDevice({
      width: forceDevice === 'desktop' ? BREAKPOINTS_DETAILED.desktop_s : BREAKPOINTS_DETAILED[forceDevice],
    });
    return () => {};
  }, [forceDevice]);

  return <Context.Provider value={providerProps}>{children}</Context.Provider>;
};
