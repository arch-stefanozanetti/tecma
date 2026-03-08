import React, { HTMLAttributes, ReactElement, ReactNode, useEffect } from 'react';

import classNames from 'classnames';

import { useLoadImage } from './utils/functions';
import { DefaultProps } from '../../declarations/defaultProps';

// styles
import '../../styles/lazyImage.scss';

// Required Props
interface LazyImageRequiredProps {
  src: string;
}

// Optional Props
interface LazyImageOptionalProps extends DefaultProps {
  dataTestId?: string;
  width?: number;
  height?: number;
  loadDelay?: number;
  viewDelay?: number;
  loadingElement?: ReactElement;
  errorElement?: ReactElement;
  onLoad?: (img: HTMLImageElement) => void;
  onRendered?: (id?: string) => void;
  onError?: (error?: unknown) => void;
  children?: ReactNode;
  load?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface LazyImageBackgroundProps
  extends LazyImageRequiredProps,
    LazyImageOptionalProps,
    DefaultProps,
    Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className' | 'id' | 'style' | 'onLoad' | 'onError'> {}

export interface LazyImageImageProps
  extends LazyImageRequiredProps,
    LazyImageOptionalProps,
    DefaultProps,
    Omit<HTMLAttributes<HTMLImageElement>, 'children' | 'className' | 'width' | 'height' | 'id' | 'style' | 'onLoad' | 'onError'> {
  alt?: string;
}

// use the optional prop interface to define the default props
export const defaultProps: LazyImageOptionalProps = {
  dataTestId: 'tecma-lazyImage',
  load: true,
  width: undefined,
  height: undefined,
  loadDelay: undefined,
  viewDelay: undefined,
  loadingElement: undefined,
  errorElement: undefined,
  onLoad: undefined,
  onError: undefined,
  children: undefined,
};

const LazyImageBackground: React.FC<LazyImageBackgroundProps> = React.memo(
  ({
    id,
    className,
    src,
    dataTestId,
    style,
    width,
    height,
    loadDelay,
    viewDelay,
    loadingElement,
    errorElement,
    onLoad,
    onRendered,
    onError,
    load,
    children,
    ...rest
  }: LazyImageBackgroundProps) => {
    const classList = classNames('tecma-lazyImage', className);

    const hasInitialError = !src;

    const { loaded, hasError } = useLoadImage({
      hasInitialError,
      load,
      onLoad,
      onError,
      loadDelay,
      viewDelay,
      id,
      src,
    });

    useEffect(() => {
      if (loaded && onRendered) {
        onRendered();
      }
    });

    return (
      <div
        id={id}
        className={classList}
        data-testid={dataTestId}
        role='img'
        style={{
          ...style,
          width,
          height,
          backgroundImage: loaded && !hasError ? `url("${src}")` : 'none',
        }}
        {...rest}
      >
        {loaded ? children : loadingElement || <div>Loading ...</div>}
        {hasError && (errorElement || 'Error')}
      </div>
    );
  },
);

const LazyImageImage: React.FC<LazyImageImageProps> = React.memo(
  ({
    id,
    className,
    src,
    dataTestId,
    style,
    width,
    height,
    loadDelay,
    viewDelay,
    loadingElement,
    errorElement,
    onLoad,
    onRendered,
    onError,
    load,
    children,
    alt,
    ...rest
  }: LazyImageImageProps) => {
    const classList = classNames('tecma-lazyImage', className);

    const hasInitialError = !src;

    const { loaded, hasError } = useLoadImage({
      hasInitialError,
      load,
      onLoad,
      onError,
      loadDelay,
      viewDelay,
      id,
      src,
    });

    useEffect(() => {
      if (loaded && onRendered) {
        onRendered();
      }
    });

    return (
      <>
        {!loaded && (
          <span id={id} className={classList} data-testid={dataTestId} style={{ ...style, width, height }}>
            {loadingElement || 'Loading...'}
          </span>
        )}
        {loaded && !hasError && (
          <img
            id={id}
            className={classList}
            data-testid={dataTestId}
            src={src}
            width={width}
            height={height}
            style={{ ...style }}
            alt={alt}
            {...rest}
          />
        )}
        {hasError && (
          <span id={id} className={classList} data-testid={dataTestId} style={{ ...style }}>
            {errorElement || 'Error'}
          </span>
        )}
      </>
    );
  },
);

LazyImageBackground.defaultProps = defaultProps;
LazyImageImage.defaultProps = { ...defaultProps, alt: '' };

const LazyImage = { Background: LazyImageBackground, Image: LazyImageImage };

export default LazyImage;
