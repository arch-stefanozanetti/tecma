import { SVG_RAW_MAP } from './svgRawMap.generated.js';

export function getIconSvgSource(iconName: string, filled: boolean): string | undefined {
  if (filled) {
    const filledKey = `./svg/${iconName}-filled.svg`;
    if (SVG_RAW_MAP[filledKey]) return SVG_RAW_MAP[filledKey];
  }
  return SVG_RAW_MAP[`./svg/${iconName}.svg`];
}
