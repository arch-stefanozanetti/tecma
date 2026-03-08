import React, { cloneElement, createContext, FC, memo, ReactElement, SVGProps, useCallback, useContext, useEffect, useRef, useState } from 'react';

import classNames from 'classnames';

import { IconName } from './IconName';
import { DefaultProps } from '../../declarations/defaultProps';
import { SizeExtended } from '../../declarations/size';
import { useId } from '../../hooks/useId';
import { getErrorMessage, getLocalIconUrl, retrieveSVGElement } from '../../icon_utilities';

// styles
import '../../styles/icon.scss';

// Required Props
interface IconRequiredProps {}

// Optional Props
interface IconOptionalProps extends SVGProps<SVGElement>, DefaultProps {
  src?: string;
  size?: SizeExtended;
  filled?: boolean;
  isLogo?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface IconProps extends IconRequiredProps, IconOptionalProps {
  iconName: IconName;
}

// use the optional prop interface to define the default props
const defaultProps: IconOptionalProps = {
  'data-testid': 'tecma-icon',
  size: 'medium',
  filled: false,
  isLogo: false,
};

/**
 * Context for providing the base URL for components of type `Icon`.
 * @example
 * <IconURLContext.Provider value="/icons/url">
 *   <Icon {...props} iconName="myIcon" />
 * </IconURLContext.Provider>
 */
export const IconURLContext = createContext('');

const Icon: FC<IconProps> = ({ className, src, iconName, size, filled, isLogo, ...svgProps }): ReactElement | null => {
  const classList = classNames('tecma-icon', { [`${size}`]: size }, { isLogo }, className);

  let iconsURL = useContext(IconURLContext);

  if (src) {
    iconsURL = src;
  }

  const completeIconName = iconName + (filled ? '-filled' : '');

  const completeIconLink = iconsURL && completeIconName && `${iconsURL}/${completeIconName}.svg`;

  const [svgElement, setSVGElement] = useState<ReactElement | null>();

  const hash = useId();
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const updateIcon = useCallback(async () => {
    // Prefer local icons first to work in environments (like Storybook) where a remote base URL may not be served
    try {
      const localIconUrl = await getLocalIconUrl(completeIconName);
      const localSVG = await retrieveSVGElement(localIconUrl, hash);
      if (isMountedRef.current) {
        setSVGElement(localSVG as ReactElement);
      }
      return;
    } catch (localError) {
      // If local retrieval fails, optionally try remote if a base URL is provided
      if (completeIconLink) {
        try {
          const remoteSVG = await retrieveSVGElement(completeIconLink, hash);
          if (isMountedRef.current) {
            setSVGElement(remoteSVG as ReactElement);
          }
          return;
        } catch (remoteError) {
          if (isMountedRef.current) {
            setSVGElement(null);
          }
          console.error(
            `Error while retrieving remote SVG for icon "${completeIconName}"`,
            getErrorMessage(remoteError)
          );
        }
      } else {
        if (isMountedRef.current) {
          setSVGElement(null);
        }
      }
      console.error(
        `Error while retrieving local SVG for icon "${completeIconName}"`,
        getErrorMessage(localError)
      );
    }
  }, [completeIconLink, hash, completeIconName]);

  useEffect(() => {
    updateIcon();
  }, [iconsURL, completeIconName, updateIcon]);

  return svgElement ? (
    cloneElement(svgElement, {
      ...svgProps,
      className: classList,
    })
  ) : (
    <svg className={classList} aria-label={svgProps['aria-label']} />
  );
};

Icon.defaultProps = defaultProps as Partial<DefaultProps>;

/**
 * Component for rendering an SVG in the virtual DOM given a URL and icon name.
 * For the icon's base URL can be either used the `src` prop or a context provider.
 * @example
 * <IconURLContext.Provider value="/icons/url">
 *   <Icon {...props} iconName="myIcon" />
 * </IconURLContext.Provider>
 */
export default memo(Icon);
