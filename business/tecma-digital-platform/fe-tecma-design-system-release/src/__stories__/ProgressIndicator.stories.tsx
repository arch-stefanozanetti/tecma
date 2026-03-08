import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Story, Meta } from '@storybook/react';

import { Button } from '../components/Button';
import ProgressIndicator, { ProgressIndicatorProps } from '../components/ProgressIndicator/ProgressIndicator';

// 👇 We create a “template” of how args map to rendering
const Template: Story<ProgressIndicatorProps> = (args) => {
  const { valueProgressBar, currentStep, steps } = args;
  const [nextValue, setNextValue] = useState<number>(valueProgressBar || 0);
  const [currStep, setCurrStep] = useState<number>(currentStep);
  const [startInterval, setStartInterval] = useState<boolean>(false);
  const myInterval = useRef<any>();
  const handleProgressBarButtonOnClick = () => {
    if (!startInterval) {
      myInterval.current = setInterval(() => setNextValue((prevValue) => prevValue + 10), 1000);
    } else {
      clearInterval(myInterval.current);
    }
    setStartInterval(!startInterval);
  };
  const handlePrevStepButtonOnClick = () => {
    if (currStep === 1) {
      setNextValue(0);
    } else {
      setCurrStep(currStep - 1);
      setNextValue(0);
    }
  };
  const handleNextStepButtonOnClick = useCallback(() => {
    if (currStep !== steps) {
      setCurrStep(currStep + 1);
      setNextValue(0);
    } else {
      setCurrStep(1);
    }
  }, [currStep, steps]);

  useEffect(() => {
    if (nextValue > 100) {
      clearInterval(myInterval.current);
      setStartInterval(!startInterval);
      if (currStep === steps) {
        setNextValue(100);
      } else {
        handleNextStepButtonOnClick();
      }
    }
  }, [nextValue, startInterval, currStep, steps, handleNextStepButtonOnClick]);

  return (
    <div
      style={{
        width: '300px',
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex' }}>
        <Button onClick={handleProgressBarButtonOnClick}>{startInterval ? 'stop' : 'start'}</Button>
      </div>
      <ProgressIndicator valueToShow style={{ marginTop: '2rem' }} {...args} valueProgressBar={nextValue} currentStep={currStep} />
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        <Button style={{ margin: '1rem' }} onClick={handlePrevStepButtonOnClick}>
          Prev
        </Button>
        <Button style={{ margin: '1rem' }} onClick={handleNextStepButtonOnClick}>
          Next
        </Button>
      </div>
    </div>
  );
};

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';

export default {
  title: 'Components/ProgressIndicator',
  component: ProgressIndicator,
  parameters: {
    componentSubtitle: '',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=309-6844',
    },
  },
  argTypes: {
    steps: {
      description: 'The number of steps',
      defaultValue: 3,
      control: 'number',
    },
    currentStep: {
      description: 'The number of the current step',
      defaultValue: 2,
      control: 'number',
    },
    valueProgressBar: {
      description: "The current step's progress bar value",
      defaultValue: 50,
      control: 'number',
    },
    valueToShow: {
      description: 'If true, show the value over the steps',
      defaultValue: 'false',
      control: 'boolean',
    },
  },
} as Meta<typeof ProgressIndicator>;
