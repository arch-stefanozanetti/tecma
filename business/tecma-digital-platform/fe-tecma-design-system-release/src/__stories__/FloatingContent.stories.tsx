import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

import FloatingContent, { FloatingContentProps } from '../components/_FloatingContent/FloatingContent';

// 👇 We create a “template” of how args map to rendering
const Template: Story<FloatingContentProps> = (args) => {
  const [isShown, setIsShown] = useState(false);
  const handleOnClick = () => setIsShown(!isShown);

  return (
    <div
      style={{
        height: '300px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <FloatingContent
        {...args}
        trigger={
          <button onClick={handleOnClick} type='button'>
            Click me!
          </button>
        }
        isShown={isShown}
      >
        <span style={{ border: '1px solid black' }}>I am the floating content component!</span>
      </FloatingContent>
    </div>
  );
};

export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';

export default {
  title: 'Components/FloatingContent',
  component: FloatingContent,
  argTypes: {
    position: {
      name: 'position',
      description: 'The floatingContent position',
      options: ['bottom-left', 'bottom-center', 'bottom-right', 'left', 'right', 'top-left', 'top-center', 'top-right'],
      control: { type: 'select' },
    },
    isShown: { table: { disable: true } },
    triggerClassName: { table: { disable: true } },
    dataTestId: { table: { disable: true } },
    id: { table: { disable: true } },
    className: { table: { disable: true } },
    parameters: { layout: 'fullscreen' },
    arrow: { defaultValue: false, control: { type: 'boolean' } },
    onToggle: {
      description: 'This function will be performed mainly to open/close the floating content',
    },
  },
} as Meta<typeof FloatingContent>;
