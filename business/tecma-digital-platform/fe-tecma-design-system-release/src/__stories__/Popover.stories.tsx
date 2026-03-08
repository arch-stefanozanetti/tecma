import React, { useState } from 'react';

import { PopoverOrigin } from '@mui/material';
import { Story, Meta } from '@storybook/react';

import { Button } from '../components/Button';
import Popover, { PopoverProps } from '../components/Popover/Popover';
import Radio from '../components/Radio/Radio';
import RadioGroup from '../components/RadioGroup/RadioGroup';

const verticalPosition = ['top', 'center', 'bottom'];
const horizontalPosition = ['left', 'center', 'right'];

type CustomRadioGroupProps = {
  label: string;
  currentValue: PopoverOrigin;
  onChange: React.Dispatch<
    React.SetStateAction<{
      vertical: number | 'top' | 'center' | 'bottom';
      horizontal: number | 'center' | 'left' | 'right';
    }>
  >;
  position: typeof verticalPosition | typeof horizontalPosition;
};
const CustomRadioGroup = ({ label, currentValue, onChange, position }: CustomRadioGroupProps) => (
  <RadioGroup
    label={label}
    onChange={(_e, value) => {
      onChange({ ...currentValue, [label]: value });
    }}
    value={currentValue[label]}
  >
    {position.map((item) => (
      <Radio label={item} value={item} />
    ))}
  </RadioGroup>
);

// 👇 We create a “template” of how args map to rendering
const Template: Story<PopoverProps> = (args) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <Popover
      {...args}
      onClose={() => setIsOpen(!isOpen)}
      trigger={<Button onClick={() => setIsOpen(!isOpen)}>show popover</Button>}
      isOpen={isOpen}
    >
      I am the Popover!
    </Popover>
  );
};

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
export const Position: Story<PopoverProps> = (args) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [position, setPosition] = useState<PopoverOrigin>({
    vertical: 'top',
    horizontal: 'left',
  });
  const [transformOrigin, setTransformOrigin] = useState<PopoverOrigin>({
    vertical: 'top',
    horizontal: 'left',
  });
  const calculatedPosition = (oldPosition: PopoverOrigin) => {
    const nextPosition: {
      top: number | string;
      left: number | string;
      translate: string;
    } = { top: 0, left: 0, translate: '-50% -50%' };
    if (oldPosition.vertical === 'center') {
      nextPosition.top = '50%';
    }
    if (oldPosition.vertical === 'bottom') {
      nextPosition.top = '100%';
    }
    if (oldPosition.horizontal === 'center') {
      nextPosition.left = '50%';
    }
    if (oldPosition.horizontal === 'right') {
      nextPosition.left = '100%';
    }
    return nextPosition;
  };
  const dotStyle = {
    position: 'absolute',
    borderRadius: '100%',
    backgroundColor: '#efeb62',
    width: '0.5rem',
    height: '0.5rem',
    ...calculatedPosition(position as PopoverOrigin),
  } as React.CSSProperties;

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
      <Popover
        {...args}
        onClose={() => setIsOpen(!isOpen)}
        trigger={
          <Button onClick={() => setIsOpen(!isOpen)} style={{ position: 'relative' }}>
            show popover
            <div style={dotStyle} />
          </Button>
        }
        isOpen={isOpen}
        position={position as PopoverOrigin}
        transformOrigin={transformOrigin as PopoverOrigin}
      >
        I am the Popover!
      </Popover>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: '1rem', gap: '2rem' }}>
        <fieldset style={{ display: 'flex', gap: '2rem' }}>
          <legend> Position</legend>
          <CustomRadioGroup label='vertical' currentValue={position as PopoverOrigin} onChange={setPosition} position={verticalPosition} />
          <CustomRadioGroup
            label='horizontal'
            currentValue={position as PopoverOrigin}
            onChange={setPosition}
            position={horizontalPosition}
          />
        </fieldset>
        <fieldset style={{ display: 'flex', gap: '2rem' }}>
          <legend> TransformOrigin</legend>
          <CustomRadioGroup
            label='vertical'
            currentValue={transformOrigin as PopoverOrigin}
            onChange={setTransformOrigin}
            position={verticalPosition}
          />
          <CustomRadioGroup
            label='horizontal'
            currentValue={transformOrigin as PopoverOrigin}
            onChange={setTransformOrigin}
            position={horizontalPosition}
          />
        </fieldset>
      </div>
    </div>
  );
};
Position.storyName = 'Position and transform origin';
Position.parameters = {
  docs: {
    description: {
      story:
        "`position` is the point of the anchor where the popover's element will attach to. The yellow dot helps to understand from where the popover will show up. The `transformOrigin` change the Popover placement relative to the yellow dot.",
    },
  },
};

export default {
  title: 'Components/Popover',
  component: Popover,
  parameters: {
    componentSubtitle: 'A Popover can be used to display some content on top of another.',
    design: {
      type: 'figma',
      url: '',
    },
  },
  argTypes: {
    trigger: {
      description: 'The element that trigger the popover',
    },
    setIsOpen: {
      description: 'The function to perform on close. This component is stateless so it should change the Popover state as first thing.',
    },
    position: {
      description: "The Popover position.This is the point on the anchor where the popover's trigger will attach to.",
      defaultValue: { vertical: 'top', horizontal: 'left' },
    },
    isOpen: {
      description: 'If true the popover is open',
      defaultValue: false,
    },
    transformOrigin: {
      description: "This is the point on the popover which will attach to the trigger's origin.",
      defaultValue: { vertical: 'top', horizontal: 'left' },
    },
  },
} as Meta<typeof Popover>;
