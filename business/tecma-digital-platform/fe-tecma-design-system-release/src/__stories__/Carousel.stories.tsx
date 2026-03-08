import React, { useState } from 'react';

import { ComponentStory, ComponentMeta, Story } from '@storybook/react';

import { Card } from '../components/Card';
import { Carousel } from '../components/Carousel';
import { CarouselProps } from '../components/Carousel/Carousel';
import { LazyImage } from '../components/LazyImage';
import { Spinner } from '../components/Spinner';

const IMAGES = [
  'https://picsum.photos/id/10/400',
  'https://picsum.photos/id/20/400',
  'https://picsum.photos/id/30/400',
  'https://picsum.photos/id/40/400',
];

const createCarouselItemImage = (index: number, slidesPerView = 1) => (
  <LazyImage.Image
    key={index}
    loadingElement={
      <div
        style={{
          width: `calc(100vw / ${slidesPerView})`,
          display: 'inline-flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Spinner />
      </div>
    }
    loadDelay={index * 1000}
    src={IMAGES[index]}
    alt='Test'
  />
);

const generateCards = (index: number) => (
  <Card key={index}>
    <Card.Media>
      <LazyImage.Image
        key={index}
        loadingElement={
          <div
            style={{
              display: 'inline-flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Spinner />
          </div>
        }
        loadDelay={index * 1000}
        src='https://m.media-amazon.com/images/I/A1ez8ji9F6L._AC_SL1500_.jpg'
        alt='Test'
      />
    </Card.Media>
    <div>
      <Card.Header>
        <h2>Titolo</h2>
      </Card.Header>
      <Card.Content>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse metus lorem, iaculis ac facilisis ac, dignissim in magna. Nulla
        porta a quam vel dictum. Sed non est gravida, mollis risus vitae, ornare ipsum. Duis a eleifend leo. Quisque vel eros in nibh
        consectetur varius. Sed mattis ultricies orci, ac lacinia orci sodales vel. Sed rutrum tempus lectus, vel pulvinar lacus efficitur
        viverra. Donec eget dictum metus. Suspendisse ex nulla, consequat ac iaculis at, facilisis in diam. Integer scelerisque, metus et
        fringilla gravida, tortor leo luctus felis, nec tincidunt neque augue quis magna. Praesent sit amet pellentesque turpis, a suscipit
        ipsum. Nullam semper odio ut viverra luctus.
      </Card.Content>
    </div>
    <Card.Footer />
  </Card>
);

// 👇 We create a “template” of how args map to rendering
const CarouselWithImageTemplate: Story<CarouselProps> = (args) => {
  const { slidesPerView } = args;
  return <Carousel {...args}>{[0, 1, 2, 3].map((el) => createCarouselItemImage(el, slidesPerView))}</Carousel>;
};

const CarouselWithCardsTemplate: Story<CarouselProps> = (args) => <Carousel {...args}>{[1, 2, 3].map(generateCards)}</Carousel>;

export const CarouselWithImage: ComponentStory<typeof Carousel> = (args) => {
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const imagesLength = IMAGES.length;

  const next = () => {
    setSelectedItemIndex((selectedItemIndex + 1) % imagesLength);
  };
  const prev = () => {
    if (selectedItemIndex === 0) {
      setSelectedItemIndex(imagesLength - 1);
    } else {
      setSelectedItemIndex((selectedItemIndex - 1) % imagesLength);
    }
  };

  return (
    <div style={{ width: '300px', height: '300px' }}>
      <CarouselWithImageTemplate
        {...args}
        selectedItemIndex={selectedItemIndex}
        onChange={(index: number) => setSelectedItemIndex(index)}
        buttons={
          <>
            <Carousel.Button iconName='arrow-left' className='prev' onClick={prev} />
            <Carousel.Button iconName='arrow-right' className='next' onClick={next} />
          </>
        }
      />
    </div>
  );
};

export const FloorPlanningCarousel: ComponentStory<typeof Carousel> = (args) => {
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const imagesLength = IMAGES.length;

  const next = () => {
    setSelectedItemIndex((selectedItemIndex + 1) % imagesLength);
  };

  const prev = () => {
    setSelectedItemIndex((selectedItemIndex - 1) % imagesLength);
  };

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <CarouselWithImageTemplate
        {...args}
        showPagination={false}
        selectedItemIndex={selectedItemIndex}
        onChange={(index: number) => setSelectedItemIndex(index)}
        buttons={
          <>
            <Carousel.Button
              iconName={isZoomed ? 'x' : 'plus'}
              className='zoom'
              disabled={false}
              onClick={() => {
                setIsZoomed(!isZoomed);
              }}
            />
            <Carousel.Button iconName='arrow-left' className='prev' disabled={selectedItemIndex === 0} onClick={prev} />
            <Carousel.Button iconName='arrow-right' className='next' disabled={selectedItemIndex === imagesLength - 1} onClick={next} />
          </>
        }
      />
    </div>
  );
};

FloorPlanningCarousel.parameters = {
  docs: {
    storyDescription: 'FloorPlanning Carousel with 3 buttons',
  },
};

export const SlidesPerView: ComponentStory<typeof Carousel> = (args) => {
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <CarouselWithImageTemplate
        {...args}
        slidesPerView={2}
        selectedItemIndex={selectedItemIndex}
        onChange={(index: number) => setSelectedItemIndex(index)}
      />
    </div>
  );
};

SlidesPerView.parameters = {
  docs: {
    storyDescription: 'Carousel with 2 slidesPerView prop setted',
  },
};

export const Centered: ComponentStory<typeof Carousel> = (args) => {
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <CarouselWithImageTemplate
        {...args}
        slidesPerView={1}
        centeredSlides
        selectedItemIndex={selectedItemIndex}
        onChange={(index: number) => setSelectedItemIndex(index)}
      />
    </div>
  );
};

Centered.parameters = {
  docs: {
    storyDescription: 'Carousel with centered prop setted for show active slide always in the middle of slider.',
  },
};

export const Cards: ComponentStory<typeof Carousel> = (args) => {
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <CarouselWithCardsTemplate
        {...args}
        slidesPerView={2}
        selectedItemIndex={selectedItemIndex}
        onChange={(index: number) => setSelectedItemIndex(index)}
      />
    </div>
  );
};

Cards.parameters = {
  docs: {
    storyDescription: 'Carousel with Tecma Card components as children',
  },
};

export const Swipe: ComponentStory<typeof Carousel> = (args) => {
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const imagesLength = IMAGES.length;

  const next = () => {
    setSelectedItemIndex((selectedItemIndex + 1) % imagesLength);
  };

  const prev = () => {
    if (selectedItemIndex - 1 < 0) {
      setSelectedItemIndex(imagesLength - 1);
    } else {
      setSelectedItemIndex(selectedItemIndex - 1);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <CarouselWithImageTemplate
        {...args}
        slidesPerView={1}
        selectedItemIndex={selectedItemIndex}
        swipe={{ prev, next }}
        onChange={(index: number) => setSelectedItemIndex(index)}
      />
    </div>
  );
};

Swipe.parameters = {
  docs: {
    storyDescription: 'Carousel with centered prop setted for show active slide always in the middle of slider.',
  },
};

export default {
  title: 'Components/Carousel',
  component: Carousel,
  argTypes: {
    selectedItem: {
      description: 'Index number of currently active slide',
      control: { type: 'number', min: 0, max: 3, defaultValue: 0 },
      table: {
        defaultValue: { summary: 0 },
      },
    },
    className: {
      control: 'text',
      description: 'CSS class name for container',
      table: {
        defaultValue: { summary: '' },
      },
    },
    loop: {
      control: 'boolean',
      defaultValue: true,
      description: 'If true, the carousel will loop.',
    },
    slideClassName: {
      control: 'text',
      description: 'CSS class name for slide item',
      table: {
        defaultValue: { summary: '' },
      },
    },
    sliderClassName: {
      control: 'text',
      description: 'CSS class name for slider component',
      table: {
        defaultValue: { summary: '' },
      },
    },
    id: {
      control: 'text',
      description: 'Custom ID for Carousel component',
      table: {
        defaultValue: { summary: '' },
      },
    },
    'data-testid': {
      control: 'text',
      description: 'Attribute used to identify a DOM node for testing purposes',
      defaultValue: 'tecma-carousel',
      table: {
        defaultValue: { summary: 'tecma-carousel' },
      },
    },
    slidesPerView: {
      control: 'number',
      defaultValue: 1,
      description: "Number of slides per view (slides visible at the same time on slider's container).",
      table: {
        defaultValue: { summary: 1 },
      },
    },
    slidesGap: {
      control: 'number',
      defaultValue: 0,
      description: 'Gap between slides (in rem).',
      table: {
        defaultValue: { summary: 0 },
      },
    },
    showPagination: {
      control: 'boolean',
      defaultValue: true,
      description: 'If true, then active pagination control.',
      table: {
        defaultValue: { summary: true },
      },
    },
    centeredSlides: {
      control: 'boolean',
      defaultValue: false,
      description: 'If true, then active slide will be centered, not always on the left side.',
      table: {
        defaultValue: { summary: false },
      },
    },
    width: {
      control: 'text',
      description: 'Width of container',
      defaultValue: '100%',
      table: {
        defaultValue: { summary: '100%' },
      },
    },
    leftArrow: {
      table: {
        category: 'icons',
        defaultValue: { summary: 'arrow-left' },
      },
      control: {
        type: 'select',
        options: ['arrow-left', 'face-1'],
      },
      defaultValue: 'arrow-left',
      description: 'Icon name for left arrow',
    },
    leftArrowClassName: {
      table: {
        category: 'icons',
        defaultValue: { summary: '' },
      },
      control: 'text',
      description: 'CSS class name of for left arrow',
    },
    rightArrow: {
      table: {
        category: 'icons',
        defaultValue: { summary: 'arrow-right' },
      },
      control: {
        type: 'select',
        options: ['arrow-right', 'face-2'],
      },
      defaultValue: 'arrow-right',
      description: 'Icon name for right arrow',
    },
    rightArrowClassName: {
      table: {
        category: 'icons',
        defaultValue: { summary: '' },
      },
      control: 'text',
      description: 'CSS class name of for right arrow',
    },
    style: {
      control: 'object',
      description: 'CSS style object for container',
    },
    swipe: {
      control: 'object',
      description: 'Next and previous functions for swipe',
    },
    onChange: {
      table: {
        category: 'Events',
      },
      description: 'Event will be fired when currently active slide is changed',
    },
    /* renderItem: {
      table: {
        category: "Events",
      },
      description: "Event will be fired when render slide",
    }, */
  },
  parameters: {
    componentSubtitle: 'Component used for display a set of Tecma Images components or Tecma Cards components',
    docs: {
      description: {
        component: 'Default Carousel with 1 slide per view',
      },
    },
  },
} as ComponentMeta<typeof Carousel>;
