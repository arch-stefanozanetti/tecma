import React, { useCallback, useState } from 'react';

import { Story, Meta } from '@storybook/react';

import { Button } from '../components/Button';
import { LazyImage } from '../components/LazyImage';
import { LazyImageBackgroundProps, LazyImageImageProps } from '../components/LazyImage/LazyImage';
import { Spinner } from '../components/Spinner';

const IMAGES = [
  'https://picsum.photos/id/10/400',
  'https://picsum.photos/id/20/400',
  'https://picsum.photos/id/30/400',
  'https://picsum.photos/id/40/400',
];

type LazyImageStoryType = LazyImageBackgroundProps & LazyImageImageProps & { backgroundImage: boolean };

// 👇 We create a “template” of how args map to rendering
const Template: Story<LazyImageStoryType> = ({ backgroundImage, ...args }: LazyImageStoryType) =>
  backgroundImage ? <LazyImage.Background {...args} /> : <LazyImage.Image {...args} />;

export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';

export const WithSpinnerComponent = ({ ...args }) => (
  <LazyImage.Background {...args} loadDelay={1000} src={IMAGES[0]} loadingElement={<Spinner />} />
);

export const LoadAfter: Story<LazyImageStoryType> = ({ backgroundImage, ...args }: LazyImageStoryType) => (
  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
    {new Array(4)
      .fill(null)
      .map((_el, index) =>
        backgroundImage ? (
          <LazyImage.Background {...args} loadDelay={index * 1000} src={IMAGES[index % IMAGES.length]} key={IMAGES[index]} />
        ) : (
          <LazyImage.Image {...args} loadDelay={index * 1000} src={IMAGES[index % IMAGES.length]} />
        ),
      )}
  </div>
);

export const MissingSrc = ({ backgroundImage, ...args }: LazyImageStoryType) =>
  backgroundImage ? (
    <LazyImage.Background {...args} loadDelay={1000} src='' loadingElement={<Spinner />} />
  ) : (
    <LazyImage.Image {...args} loadDelay={1000} src='' loadingElement={<Spinner />} />
  );

export const LoadOnRequest: Story<LazyImageStoryType> = ({ backgroundImage, ...args }: LazyImageStoryType) => {
  const [load, setLoad] = useState(false);
  const handleClick = useCallback(() => {
    setLoad(true);
  }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Button onClick={handleClick} style={{ marginBottom: 20 }} disabled={load}>
        Load image
      </Button>
      {backgroundImage ? (
        <LazyImage.Background {...args} load={load} loadingElement={<Spinner />} />
      ) : (
        <LazyImage.Image {...args} load={load} loadingElement={<Spinner />} />
      )}
    </div>
  );
};

interface ImgInfo {
  width?: number;
  height?: number;
}

export const LoadRenderedCallback: Story<LazyImageStoryType> = ({ backgroundImage, ...args }: LazyImageStoryType) => {
  const [loaded, setLoaded] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [imgInfo, setImgInfo] = useState<ImgInfo>();

  const onLoad = useCallback((img: HTMLImageElement) => {
    setLoaded(true);
    setImgInfo({ width: img?.width, height: img?.height });
  }, []);

  const onRendered = useCallback(() => {
    setRendered(true);
  }, []);

  return (
    <div>
      <LazyImage.Image {...args} onLoad={onLoad} onRendered={onRendered} />
      <p>loaded: {String(loaded)}</p>
      <p>rendered: {String(rendered)}</p>
      <p>img info:</p>
      <ul>
        {imgInfo &&
          Object.entries(imgInfo).map(([key, value]: [string, unknown]) => (
            <li>
              {key}: {value}
            </li>
          ))}
      </ul>
    </div>
  );
};

export default {
  title: 'Components/LazyImage',
  component: LazyImage.Background,
  args: {
    src: IMAGES[0],
    width: 200,
    height: 200,
    loadDelay: 1000,
    viewDelay: 500,
  },
  argTypes: {
    backgroundImage: {
      control: 'boolean',
      defaultValue: true,
    },
    src: {
      control: 'select',
      options: [...IMAGES, 'nonExisting'],
    },
    width: {
      control: {
        type: 'range',
        min: 5,
        max: 500,
        step: 1,
      },
    },
    height: {
      control: {
        type: 'range',
        min: 5,
        max: 500,
        step: 1,
      },
    },
    loadDelay: {
      control: {
        type: 'range',
        min: 0,
        max: 2000,
        step: 500,
      },
    },
    viewDelay: {
      control: {
        type: 'range',
        min: 0,
        max: 2000,
        step: 500,
      },
    },
  },
} as Meta<typeof LazyImage>;
