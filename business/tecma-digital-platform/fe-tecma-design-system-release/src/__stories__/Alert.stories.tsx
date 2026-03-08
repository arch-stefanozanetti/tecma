import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

import Alert, { AlertProps } from '../components/Alert/Alert';
import { Button } from '../components/Button';

// 👇 We create a “template” of how args map to rendering
const Template: Story<AlertProps> = (args) => <Alert {...args} />;

// Stories
export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';
export const Title = Template.bind({});
Title.args = { title: 'hello', description: '' };
export const Description = Template.bind({});
Description.args = { description: 'Alert description' };
export const Actions = Template.bind({});
Actions.args = {
  actions: (
    <Button
      onClick={() => {
        console.log('clicked');
      }}
      size='small'
      outlined
    >
      Details
    </Button>
  ),
};

export const ContentDirection: Story<AlertProps> = (args) => (
  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
    <Alert
      {...args}
      type='primary'
      title='Default'
      style={{ width: 376 }}
      contentDirection='horizontal'
      dismissable
      description='Lorem, ipsum dolor sit amet consectetur adipisicing elit.<br /> Odio ad pariatur voluptates?'
      actions={
        <Button
          onClick={() => {
            console.log('clicked');
          }}
          size='small'
          outlined
        >
          Details
        </Button>
      }
    />
  </div>
);
export const Type: Story<AlertProps> = (args) => (
  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
    <Alert {...args} type='default' title='Default' />
    <Alert {...args} type='success' title='Success' />
    <Alert {...args} type='warning' title='Warning' />
    <Alert {...args} type='informative' title='Informative' />
    <Alert {...args} type='error' title='Error' />
    <Alert {...args} type='primary' title='Primary' />
  </div>
);
Type.args = { type: 'default' };

export const Dismissable: Story<AlertProps> = (args) => {
  const [alerts, setAlerts] = useState<Array<string>>(['Alert nr. 1']);
  const addingAlertsHandler = () => {
    setAlerts([...alerts, `Alert nr. ${alerts.length + 1}`]);
  };
  const dismissAlertHandler = (alertTitle: string) => {
    setAlerts([...alerts.filter((alert) => alert !== alertTitle)]);
  };
  return (
    <div>
      <Button onClick={addingAlertsHandler} style={{ marginBottom: '1rem' }}>
        Add alert
      </Button>
      {alerts.map((alert) => (
        <Alert {...args} title={alert} dismissable onDismiss={() => dismissAlertHandler(alert)} key={alert} />
      ))}
    </div>
  );
};
Dismissable.args = { dismissable: true };

export default {
  title: 'Components/Alert',
  component: Alert,
  parameters: {
    componentSubtitle: 'A way of informing the user of important changes in a prominent way.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/ZRftnYLwNGRshiXEkS7WGM/Tecma-Software-Suite?node-id=304-6820',
    },
  },
  argTypes: {
    title: {
      description: 'The alert title',
      defaultValue: 'hello',
      control: 'text',
    },
    description: {
      description: 'The alert description',
      defaultValue: 'hello',
      control: 'text',
    },
    actions: {
      description: 'The alert actions',
      defaultValue: undefined,
      control: 'text',
    },
    type: {
      description: "The alert type, could be 'default', 'success', 'warning', 'error' and 'informative'",
      defaultValue: 'default',
      control: 'radio',
      options: ['default', 'success', 'warning', 'error', 'informative', 'primary'],
    },
    dismissable: {
      description: 'Defines if the alert is dismissable or not',
      defaultValue: false,
      control: 'boolean',
    },
    onDismiss: {
      description: 'The callback to perform on dismiss',
      defaultValue: undefined,
      control: 'text',
    },
  },
} as Meta<typeof Alert>;
