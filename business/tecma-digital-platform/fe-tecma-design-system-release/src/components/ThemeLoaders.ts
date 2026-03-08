export interface RGB {
  b: number;
  g: number;
  r: number;
}

export interface HSL {
  h: number;
  l: number;
  s: number;
}

const expandHex = (hex: string): string => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (_m, r, g, b) => {
    return r + r + g + g + b + b;
  });

  return `#${hex.replace('#', '')}`;
};

const hexToRGB = (hex: string): RGB => {
  hex = expandHex(hex);
  hex = hex.replace('#', '');
  const intValue: number = parseInt(hex, 16);

  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
};

const hslToRGB = ({ h, s, l }: HSL): RGB => {
  h /= 360;
  s /= 100;
  l /= 100;
  if (s === 0) {
    l = Math.round(l * 255);
    return {
      r: l,
      g: l,
      b: l,
    };
  }

  const hue2rgb = (pValue: number, qValue: number, t: number) => {
    if (t < 0) {
      t += 1;
    }
    if (t > 1) {
      t -= 1;
    }
    if (t < 1 / 6) {
      return pValue + (qValue - pValue) * 6 * t;
    }
    if (t < 1 / 2) {
      return qValue;
    }
    if (t < 2 / 3) {
      return pValue + (qValue - pValue) * (2 / 3 - t) * 6;
    }
    return pValue;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
};

const rgbToHex = ({ r, g, b }: RGB) => `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).split('.')[0]}`;

const rgbToHSL = ({ r, g, b }: RGB): HSL => {
  r = Math.max(Math.min(r / 255, 1), 0);
  g = Math.max(Math.min(g / 255, 1), 0);
  b = Math.max(Math.min(b / 255, 1), 0);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = Math.min(1, Math.max(0, (max + min) / 2));
  let d;
  let h;
  let s;

  if (max !== min) {
    d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) {
      h = (g - b) / d + (g < b ? 6 : 0);
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else {
      h = (r - g) / d + 4;
    }
    h /= 6;
  } else {
    h = 0;
    s = 0;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

const darken = (hsl: HSL): HSL => {
  const hslEdited = { ...hsl };
  hslEdited.l -= 15;
  return hslEdited;
};

const lighten = (hsl: HSL): HSL => {
  const hslEdited = { ...hsl };
  hslEdited.l += 15;
  return hslEdited;
};

export interface FontType {
  url: string;
  name: string;
}

const loadFonts = (key: string, font: FontType) => {
  const link = document.createElement('link');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('type', 'text/css');
  link.setAttribute('href', font.url);
  document.documentElement.style.setProperty(`--${key}`, font.name);
  document.head.appendChild(link);
};

/**
 * This function creates global css variable loaded form DB
 * @deprecated in favor of `loadCSSVariables`
 */
export const loadScssFromDB = (initiativesStyles: { [key: string]: string }, projectStyle: { [key: string]: string }): void => {
  const loadStyle = (style: { [key: string]: string }) => {
    if (style) {
      Object.keys(style).forEach((key) => {
        if (style[key] !== '') {
          document.documentElement.style.setProperty(`--${key}`, style[key]);
          if (
            [
              'primary',
              'secondary',
              'accent',
              'accent-alternative',
              'semantic-alert',
              'semantic-warning',
              'semantic-info',
              'semantic-success',
              'semantic-disabled',
            ].includes(key)
          ) {
            document.documentElement.style.setProperty(`--${key}-light`, `${rgbToHex(hslToRGB(lighten(rgbToHSL(hexToRGB(style[key])))))}`);
            document.documentElement.style.setProperty(`--${key}-dark`, `${rgbToHex(hslToRGB(darken(rgbToHSL(hexToRGB(style[key])))))}`);
          }
          if (key === 'textFont' || key === 'ctaFont') {
            loadFonts(key, style[key] as any); // FIXME: Wrong type
          }
        }
      });
    }
  };
  loadStyle(initiativesStyles);
  loadStyle(projectStyle);
};

/**
 * List of keys for variables that require "-dark" and "-light" variants
 */
export const COLOR_VARIABLES_LIGHT_DARK_VARIANTS = [
  'primary',
  'secondary',
  'accent',
  'accent-alternative',
  'semantic-alert',
  'semantic-warning',
  'semantic-info',
  'semantic-success',
  'semantic-disabled',
];

/**
 * Adds global CSS variables to the HTML document from a list of variables
 * @param list List of couples `[key, value]` of the variables to be added to the document
 */
export const addVariablesToDocument = (list: [string, string][]) => {
  list.forEach(([key, value]) => {
    if (key !== '') {
      document.documentElement.style.setProperty(`--${key}`, value);
    }
  });
};

/**
 * Retrieves all variables form a project style configuration included light and dark variant for
 * color variables that requires it.
 * @param projectStyle Style configuration object containing custom variables
 * @param colorVariantKeys List of the variables keys of colors that require light and
 * dark variants.
 * @returns Array containing key, value couples of the variables
 */
export const getAllCSSVariables = (projectStyle: { [key: string]: string }, colorVariantKeys: string[]) => {
  const variables: [string, string][] = [];
  Object.entries(projectStyle).forEach(([key, value]) => {
    variables.push([key, value]);
    if (colorVariantKeys.includes(key)) {
      variables.push([`${key}-light`, `${rgbToHex(hslToRGB(lighten(rgbToHSL(hexToRGB(value)))))}`]);
      variables.push([`${key}-dark`, `${rgbToHex(hslToRGB(darken(rgbToHSL(hexToRGB(value)))))}`]);
    }
  });
  return variables;
};

/**
 * Adds global CSS variables to the HTML document from a project style configuration
 * @param projectStyle Style configuration object containing custom variables
 * @param colorVariantKeys (optional) List of the variables keys of colors that require light and
 * dark variants. Defaults to `COLOR_VARIABLES_LIGHT_DARK_VARIANTS`
 */
export const loadCSSVariables = (projectStyle: { [key: string]: string }, colorVariantKeys = COLOR_VARIABLES_LIGHT_DARK_VARIANTS) => {
  const variables = getAllCSSVariables(projectStyle, colorVariantKeys);
  addVariablesToDocument(variables);
};
