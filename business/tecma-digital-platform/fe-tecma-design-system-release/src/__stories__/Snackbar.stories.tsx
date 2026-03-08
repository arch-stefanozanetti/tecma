import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

import { Button } from '../components/Button';
import { Snackbar } from '../components/Snackbar';
import { SnackbarProps } from '../components/Snackbar/Snackbar';

export const Template: Story<SnackbarProps> = (args) => {
  const [isShown, setIsShown] = useState(false);
  const handleOnClick = () => setIsShown(!isShown);
  const handleOnClose = () => setIsShown(false);
  return (
    <>
      <Snackbar {...args} open={isShown} handleClose={handleOnClose} />
      <Button onClick={handleOnClick}>Click me!</Button>
    </>
  );
};
Template.storyName = 'Basic Usage';

export const CustomDuration = Template.bind({});
CustomDuration.args = {
  hideDuration: 5000,
};

export const WithAction = Template.bind({});
WithAction.args = {
  title: 'Click the button below',
  // eslint-disable-next-line no-alert
  actions: <Button onClick={() => alert('Button clicked!')}>Click me</Button>,
};

export const WithSuccess = Template.bind({});
WithSuccess.args = {
  title: 'Success',
  description: 'This is a success message',
  type: 'success',
};

export const WithWarning = Template.bind({});
WithWarning.args = {
  title: 'Warning',
  description: 'This is a warning',
  type: 'warning',
};

export const WithError = Template.bind({});
WithError.args = {
  title: 'Error',
  description: 'This is an error',
  type: 'error',
};

export const WithInfo = Template.bind({});
WithInfo.args = {
  title: 'Info',
  description: 'This is an info',
  type: 'informative',
};

export default {
  title: 'Components/Snackbar',
  component: Snackbar,
  argTypes: {
    open: {
      description: 'If true, the component is shown.',
      control: 'boolean',
    },
    handleClose: {
      description: 'Callback fired when the component requests to be closed.',
    },
    title: {
      description: 'The snackbar title',
      control: 'text',
    },
    description: {
      description: 'The snackbar description',
      control: 'text',
    },
    type: {
      description: 'The snackbar type',
      control: 'radio',
      options: ['default', 'primary', 'success', 'warning', 'error', 'informative'],
    },
    actions: {
      description: 'Snackbar content',
      control: 'text',
    },
    anchorOrigin: {
      description: 'Anchor position',
      control: 'object',
    },
    hideDuration: {
      description: 'The number of milliseconds to wait before automatically calling the handleClose function',
      control: 'number',
    },
    alertClassName: {
      description: 'Alert className',
      control: 'text',
    },
    key: {
      description: 'Key prop to ensure independent treatment of each snackbar',
      control: 'text',
    },
  },
  args: {
    title: 'The snackbar title',
    description: 'The snackbar description',
    type: 'default',
    actions: undefined,
    anchorOrigin: { vertical: 'top', horizontal: 'right' },
    alertClassName: '',
    key: '',
  },
} as Meta;
