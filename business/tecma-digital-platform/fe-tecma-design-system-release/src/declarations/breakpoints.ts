import { Device, DeviceDetailed } from './device';

export type Breakpoints = {
  [key in Device]?: number;
};

export type BreakpointsDetailed = {
  [key in DeviceDetailed]?: number;
};
