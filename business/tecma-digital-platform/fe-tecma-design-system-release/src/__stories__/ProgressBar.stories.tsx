import React, { useEffect, useRef, useState } from 'react';

import { Story, Meta } from '@storybook/react';

import { Button } from '../components/Button';
import ProgressBar, { ProgressBarProps } from '../components/ProgressBar/ProgressBar';

// 👇 We create a “template” of how args map to rendering
const Template: Story<ProgressBarProps> = (args) => {
  const { value } = args;
  const [nextValue, setNextValue] = useState<number>(value || 0);
  const [startInterval, setStartInterval] = useState<boolean>(false);
  const myInterval = useRef<any>();
  const handleButtonOnClick = () => {
    if (!startInterval) {
      myInterval.current = setInterval(() => setNextValue((prevValue) => prevValue + 10), 1000);
    } else {
      clearInterval(myInterval.current);
    }
    setStartInterval(!startInterval);
  };
  useEffect(() => {
    if (nextValue > 100) {
      clearInterval(myInterval.current);
      setStartInterval(!startInterval);
      setNextValue(0);
    }
  }, [nextValue, startInterval]);

  return (
    <div
      style={{
        width: '300px',
        height: '100px',
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex' }}>
        <Button onClick={handleButtonOnClick}>{startInterval ? 'stop' : 'start'}</Button>
      </div>
      <ProgressBar {...args} value={nextValue} style={{ marginTop: '3rem' }} valueToShow={`${nextValue}%`} />
    </div>
  );
};

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';

export default {
  title: 'Components/ProgressBar',
  component: ProgressBar,
  parameters: {
    componentSubtitle:
      'A horizontal bar indicating the current completion status of a long-running task, usually updated continuously as the task progresses, instead of in discrete steps.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=309-6844',
    },
  },
  argTypes: {
    value: {
      description: 'The progress bar value',
      defaultValue: 0,
      control: 'number',
    },
    valueToShow: {
      description: 'The value to show over the progress bar',
      defaultValue: '',
      control: 'text',
    },
  },
} as Meta<typeof ProgressBar>;
