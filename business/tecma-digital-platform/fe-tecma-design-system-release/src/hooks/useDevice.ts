import { useContext } from 'react';

import { BREAKPOINTS_DETAILED, BREAKPOINTS } from '../constants/breakpoints';
import { Context } from '../context/device';

import type { Device, DeviceDetailed } from '../declarations/device';

export const useDevice = () => {
  const { device: deviceState } = useContext(Context);
  const deviceWidth = deviceState.width || 0;

  const deviceDetailed =
    Object.keys(BREAKPOINTS_DETAILED).find(
      (key) => deviceWidth <= (BREAKPOINTS_DETAILED ? (BREAKPOINTS_DETAILED[key as unknown as DeviceDetailed] as unknown as number) : 0),
    ) || 'desktop_l';

  const device =
    Object.keys(BREAKPOINTS).find(
      (key) => deviceWidth <= (BREAKPOINTS ? (BREAKPOINTS[key as unknown as Device] as unknown as number) : 0),
    ) || 'desktop';

  return {
    type: device as Device,
    typeDetailed: deviceDetailed as DeviceDetailed,
    width: deviceWidth,
  };
};
