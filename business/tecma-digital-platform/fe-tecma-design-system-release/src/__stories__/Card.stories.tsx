import React from 'react';

import { Story, ComponentMeta } from '@storybook/react';

import { Button } from '../components/Button';
import { Card, CardProps } from '../components/Card/Card';

// 👇 We create a “template” of how args map to rendering
export const Template: Story<CardProps> = (args) => {
  return (
    <Card {...args}>
      <Card.Media>
        <img src='https://m.media-amazon.com/images/I/A1ez8ji9F6L._AC_SL1500_.jpg' alt='shiba' />
      </Card.Media>
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
      <Card.Footer />
    </Card>
  );
};
Template.storyName = 'Basic Usage';

export const BorderLessTemplate: Story<CardProps> = (args) => {
  return (
    <Card {...args} borderLess>
      <Card.Media>
        <img src='https://m.media-amazon.com/images/I/A1ez8ji9F6L._AC_SL1500_.jpg' alt='shiba' />
      </Card.Media>
      <Card.Container>
        <Card.Header>
          <h2>Titolo</h2>
        </Card.Header>
        <Card.Content>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse metus lorem, iaculis ac facilisis ac, dignissim in magna.
          Nulla porta a quam vel dictum. Sed non est gravida, mollis risus vitae, ornare ipsum. Duis a eleifend leo. Quisque vel eros in
          nibh consectetur varius. Sed mattis ultricies orci, ac lacinia orci sodales vel. Sed rutrum tempus lectus, vel pulvinar lacus
          efficitur viverra. Donec eget dictum metus. Suspendisse ex nulla, consequat ac iaculis at, facilisis in diam. Integer scelerisque,
          metus et fringilla gravida, tortor leo luctus felis, nec tincidunt neque augue quis magna. Praesent sit amet pellentesque turpis,
          a suscipit ipsum. Nullam semper odio ut viverra luctus.
        </Card.Content>
      </Card.Container>
      <Card.Footer>
        <Button onClick={() => console.log('click')}>save</Button>
      </Card.Footer>
    </Card>
  );
};
BorderLessTemplate.storyName = 'BorderLess Usage';
BorderLessTemplate.parameters = {
  docs: {
    description: {
      story:
        'The borderless card removes the padding around the entire card. Using `Card.Container`, both the card content (`Card.Header` and `Card.Content`) and the `Card.Footer` will have their own padding.',
    },
  },
};

export const VideoTemplate: Story<CardProps> = (args) => {
  return (
    <Card {...args}>
      <Card.Media>
        <video data-testid='tecma-card-video'>
          <source src='https://samplelib.com/lib/preview/webm/sample-5s.webm' type='video/webm' />
          <track default kind='captions' />
        </video>
      </Card.Media>
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
      <Card.Footer />
    </Card>
  );
};
VideoTemplate.storyName = 'Video Media';

export const HorizontalTemplate: Story<CardProps> = (args) => {
  return (
    <Card {...args} orientation='horizontal'>
      <Card.Media>
        <img src='https://m.media-amazon.com/images/I/A1ez8ji9F6L._AC_SL1500_.jpg' alt='shiba' />
      </Card.Media>
      <Card.Container>
        <Card.Header>
          <h2>Titolo</h2>
        </Card.Header>
        <Card.Content>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse metus lorem, iaculis ac facilisis ac, dignissim in magna.
          Nulla porta a quam vel dictum. Sed non est gravida, mollis risus vitae, ornare ipsum. Duis a eleifend leo. Quisque vel eros in
          nibh consectetur varius. Sed mattis ultricies orci, ac lacinia orci sodales vel. Sed rutrum tempus lectus, vel pulvinar lacus
          efficitur viverra. Donec eget dictum metus. Suspendisse ex nulla, consequat ac iaculis at, facilisis in diam. Integer scelerisque,
          metus et fringilla gravida, tortor leo luctus felis, nec tincidunt neque augue quis magna. Praesent sit amet pellentesque turpis,
          a suscipit ipsum. Nullam semper odio ut viverra luctus.
        </Card.Content>
      </Card.Container>
      <Card.Footer />
    </Card>
  );
};
HorizontalTemplate.storyName = 'Horizontal Card';

export const CardTableTemplate: Story<CardProps> = (args) => {
  const data = [
    {
      label: 'rental',
      value: '100€',
    },
    { label: 'deposit', value: '500€' },
    { label: 'parkingSpot', value: '25€' },
    { label: 'total', value: '625€' },
  ];
  return (
    <div style={{ display: 'flex' }}>
      <Card {...args} style={{ width: 'unset', flex: 1 }}>
        <Card.Media>
          <img src='https://m.media-amazon.com/images/I/A1ez8ji9F6L._AC_SL1500_.jpg' alt='shiba' />
        </Card.Media>
        <div>
          <Card.Header>
            <h2>Card with table</h2>
          </Card.Header>
          <Card.Table data={data} />
        </div>
        <Card.Footer />
      </Card>
      <Card {...args} style={{ width: 'unset', flex: 1 }}>
        <Card.Media>
          <img src='https://m.media-amazon.com/images/I/A1ez8ji9F6L._AC_SL1500_.jpg' alt='shiba' />
        </Card.Media>
        <div>
          <Card.Header>
            <h2>Card with table and divider between rows</h2>
          </Card.Header>

          <Card.Table data={data} dividerBetweenRows />
        </div>
        <Card.Footer />
      </Card>
      <Card {...args} style={{ width: 'unset', flex: 1 }}>
        <Card.Media>
          <img src='https://m.media-amazon.com/images/I/A1ez8ji9F6L._AC_SL1500_.jpg' alt='shiba' />
        </Card.Media>
        <div>
          <Card.Header>
            <h2>Card with table and divider before latest row</h2>
          </Card.Header>
          <Card.Table data={data} dividerAtTheEnd />
        </div>
        <Card.Footer />
      </Card>
    </div>
  );
};
CardTableTemplate.storyName = 'Table Card';
CardTableTemplate.parameters = {
  docs: {
    description: {
      story:
        "The Card Table could be use to show data as table. It has two props to show a divider: `dividerBetweenRows` and `dividerAtTheEnd`. `dividerBetweenRows`: when it's true, it shows a divider between rows. `dividerAtTheEnd`: when it's true, it shows a divider only before the latest row.  ",
    },
  },
};

export default {
  title: 'Components/Card',
  component: Card,
  argTypes: {
    fluid: {
      control: 'boolean',
    },
    setSelected: { action: 'clicked' },
  },
} as ComponentMeta<typeof Card>;
