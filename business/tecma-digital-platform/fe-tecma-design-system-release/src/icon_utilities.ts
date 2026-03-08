import { isValidElement, ReactNode } from 'react';

import convert from 'react-from-dom';

const fetchSVG = async (url: string) => {
  const response = await fetch(url);

  const contentType = response.headers.get('content-type');
  const [fileType] = (contentType || '').split(/ ?; ?/);

  if (response.status > 299) {
    throw new Error('Not found');
  }
  if (!['image/svg+xml', 'text/plain'].some((d) => fileType.includes(d))) {
    throw new Error(`Content type isn't valid: ${fileType}`);
  }

  return response.text();
};

const updateSVGAttributes = (node: SVGSVGElement, hash: string): SVGSVGElement => {
  const replaceableAttributes = ['id', 'href', 'xlink:href', 'xlink:role', 'xlink:arcrole'];
  const linkAttributes = ['href', 'xlink:href'];
  const isDataValue = (name: string, value: string) => linkAttributes.includes(name) && (value ? !value.includes('#') : false);

  Array.from(node.children).map((d) => {
    if (d.attributes && d.attributes.length) {
      const attributes = Object.values(d.attributes).map((a) => {
        const attribute = a;
        const match = a.value.match(/url\((.*?)\)/);

        if (match && match[1]) {
          attribute.value = a.value.replace(match[0], `url(${match[1]}__${hash})`);
        }

        return attribute;
      });

      replaceableAttributes.forEach((r) => {
        const attribute = attributes.find((a) => a.name === r);

        if (attribute && !isDataValue(r, attribute.value)) {
          attribute.value = `${attribute.value}__${hash}`;
        }
      });
    }

    if (d.children.length) {
      return updateSVGAttributes(d as SVGSVGElement, hash);
    }
    return d;
  });
  return node;
};

const getSVGElement = (content: string, hash: string): ReactNode | undefined => {
  const node = convert(content, { nodeOnly: true });
  if (!node || !(node instanceof SVGSVGElement)) {
    throw new Error('Could not convert the src to a DOM Node');
  }
  const svg = updateSVGAttributes(node, hash);
  const element = convert(svg);
  if (!element || !isValidElement(element)) {
    throw new Error('Could not convert the src to a React element');
  }
  return element;
};

export const getLocalIconUrl = async (iconName: string) => {
  return (await import(`./assets/svg/${iconName}.svg`)).default;
};

export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

export const retrieveSVGElement = async (url: string, hash: string) => {
  const svgContent = await fetchSVG(url);
  const svgElement = getSVGElement(svgContent, hash);
  return svgElement;
};
