import { useCallback, useEffect, useState } from 'react';

import { wait } from '../../../helpers/asyncUtils';

export const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (src) {
      img.src = src;
      img.onload = () => {
        resolve(img);
      };
      img.onerror = (error) => {
        console.error(`Error while retrieving image "${src}"`, error);
        reject(error);
      };
    } else {
      reject(new Error('Missing src'));
    }
  });
};

export const useLoadImage = ({
  hasInitialError,
  loadDelay,
  viewDelay,
  id,
  src,
  load,
  onLoad,
  onError,
}: {
  hasInitialError: boolean;
  load?: boolean;
  onLoad?: (img: HTMLImageElement) => void;
  onError?: (error?: unknown) => void;
  loadDelay?: number;
  viewDelay?: number;
  id?: string;
  src: string;
}) => {
  const [{ loaded, hasError }, setState] = useState({
    loaded: hasInitialError,
    hasError: hasInitialError,
  });

  const onMount = useCallback(async () => {
    setState({
      loaded: false,
      hasError: false,
    });
    try {
      await Promise.all([
        wait(loaded ? 0 : loadDelay)
          .then(() => loadImage(src))
          .then((img) => onLoad && onLoad(img)),
        wait(viewDelay),
      ]);
      setState({
        loaded: true,
        hasError: false,
      });
    } catch (error) {
      if (onError) {
        onError(error);
      }
      setState({
        loaded: true,
        hasError: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loadDelay, onLoad, src, viewDelay]);

  useEffect(() => {
    if (load && src) {
      onMount();
    }
  }, [load, onMount, src]);

  return { loaded, hasError };
};
