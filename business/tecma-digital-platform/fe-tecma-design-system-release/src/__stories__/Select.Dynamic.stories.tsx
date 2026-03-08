import React from 'react';
import { Story, Meta } from '@storybook/react';
import { SelectDynamic, Props, OptionSelectDynamic } from '../components/SelectDynamic/Select.Dynamic';
import { DeviceContext } from '../context/device';

const sampleClients: OptionSelectDynamic[] = Array.from({ length: 10 }, (_, i) => ({
  value: `client-${i + 1}`,
  disabled: i % 3 === 0,
  label: `First${i + 1} OR Last${i + 1}`,
  email: `client${i + 1}@email.com`,
}));
const totalClients: OptionSelectDynamic[] = Array.from({ length: 100 }, (_, i) => ({
  value: `client-${i + 1}`,
  disabled: i % 3 === 0,
  label: `First${i + 1} OR Last${i + 1}`,
  email: `client${i + 1}@email.com`,
}));

const Template: Story<Props> = (args) => {
  const [value, setValue] = React.useState<OptionSelectDynamic | undefined>();


  return (
    <DeviceContext>
    <div style={{ height: '700px' }}>
      <div style={{ height: '300px' }} />
      <SelectDynamic
        {...args}
        items={sampleClients}
        value={value}
        onSelectionChange={setValue}
        fetchItems={(props) => {
          console.log('fetchItems', props);
          return Promise.resolve(totalClients);
        }}
        menuPlacement='auto'
      />
    </div>
    </DeviceContext>
  );
};

export const BasicUsage = Template.bind({});
BasicUsage.args = {
  placeholder: 'Select an item...',
  label: 'Choose a Client',
  perPage: 10,
  searchPlaceholder: 'Search clients...',
  disabledTooltipText: 'This account is currently deactivated. Please contact support.',
  items: sampleClients, 
};

export default {
  title: 'Components/SelectDynamic',
  component: SelectDynamic,
  parameters: {
    componentSubtitle:
      'A dynamic single-select component that supports both dynamic fetching and static lists, along with search capabilities and tooltips for disabled items.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/design/your-design-url',
    },
  },
  argTypes: {
    placeholder: {
      description: 'Placeholder text when no item is selected.',
      control: 'text',
      defaultValue: 'Select an item...',
    },
    label: {
      description: 'Label for the select input.',
      control: 'text',
      defaultValue: 'Choose a Client',
    },
    perPage: {
      description: 'Number of items to load per page.',
      control: 'number',
      defaultValue: 10,
    },
    size: {
      description: 'Size of the component (small, medium, large).',
      control: { type: 'radio', options: ['small', 'medium', 'large'] },
      defaultValue: 'medium',
    },
    searchPlaceholder: {
      description: 'Placeholder for the search input.',
      control: 'text',
      defaultValue: 'Search clients...',
    },
    disabledTooltipText: {
      description:
        'Tooltip text displayed for disabled items. Defaults to "This account is currently deactivated. Please contact support."',
      control: 'text',
      defaultValue: 'This account is currently deactivated. Please contact support.',
    },
    fetchItems: {
      description: 'Consumer-supplied API call to fetch data. When using static items, leave this undefined.',
      table: { disable: true },
      control: false,
    },
    onSelectionChange: {
      description: 'Callback fired when the selection changes.',
      action: 'onSelectionChange',
    },
  },
} as Meta<typeof SelectDynamic>;
