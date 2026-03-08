import React from 'react';
import { Story, Meta } from '@storybook/react';
import { SelectDynamicMultiple, Props, OptionSelectDynamic } from '../components/SelectDynamicMultiple/Select.DynamicMultiple';
import { DeviceContext } from '../context/device';

const sampleClients: OptionSelectDynamic[] = Array.from({ length: 10 }, (_, i) => ({
  value: `client-${i + 1}`,
  label: `First${i + 1} Last${i + 1} (client${i + 1}@email.com)`,
  tooltipText: `First${i + 1} Last${i + 1} (client${i + 1}@email.com)`,
  disabled: i % 3 === 0,
  projectIds: [],
}));

const Template: Story<Props> = (args) => {
  const [value, setValue] = React.useState<OptionSelectDynamic[] | undefined>();

  return (
    <DeviceContext>
      <div style={{ height: '700px' }}>
        <div style={{ height: '300px' }} />
        <SelectDynamicMultiple
          {...args}
          items={sampleClients}
          value={value}
          onSelectionChange={setValue}
          fetchClients={(props) => {
            console.log('fetchItems', props);
            return Promise.resolve(sampleClients);
          }}
        />
      </div>
    </DeviceContext>
  );
};

export const BasicUsage = Template.bind({});
BasicUsage.args = {
  placeholder: 'Select a client...',
  label: 'Clients',
  perPage: 3,
  clearSelectionText: 'Clear selection',
  useShowMorePagination: false,
  showMoreText: 'Show More',
  disabledTooltipText: 'This account is currently deactivated. To reactivate it navigate to the Account Manager section in FollowUp',
  // Using static data here; you can also supply a fetchClients function.
  items: sampleClients,
  value: sampleClients,
  loadingText: 'Loading Text',
  emptyStateText: 'Empty State Text',
};

export default {
  title: 'Components/SelectDynamicMultiple',
  component: SelectDynamicMultiple,
  parameters: {
    componentSubtitle:
      'A dynamic multi-select component featuring infinite scrolling or a "Show More" button, search capabilities, and pinned selected items with a clear selection option. Supports multiple sizes (small, medium, large) and allows the consumer to pass either a static list of entries or a custom API call.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/design/your-design-url',
    },
  },
  argTypes: {
    className: {
      description: 'Optional CSS class to add to the DynamicMultiSelect container.',
      defaultValue: '',
      control: 'text',
    },
    placeholder: {
      description: 'Placeholder text when no items are selected.',
      defaultValue: 'Select a client...',
      control: 'text',
    },
    label: {
      description: 'Label for the multi-select input.',
      defaultValue: 'Clients',
      control: 'text',
    },
    perPage: {
      description: 'Number of items to load per page.',
      defaultValue: 20,
      control: 'number',
    },
    size: {
      description: 'Size of the component (small, medium, large).',
      defaultValue: 'medium',
      control: { type: 'radio', options: ['small', 'medium', 'large'] },
    },
    clearSelectionText: {
      description: 'Text for the clear selection link (for i18n).',
      defaultValue: 'Clear selection',
      control: 'text',
    },
    useShowMorePagination: {
      description: 'When true, a "Show More" button is displayed to fetch the next page, disabling infinite scroll.',
      defaultValue: false,
      control: 'boolean',
    },
    showMoreText: {
      description: 'Text for the "Show More" button.',
      defaultValue: 'Show More',
      control: 'text',
    },
    disabledTooltipText: {
      description:
        'Custom tooltip text displayed for disabled items. Defaults to "This account is currently deactivated. To reactivate it navigate to the Account Manager section in FollowUp".',
      defaultValue: 'This account is currently deactivated. To reactivate it navigate to the Account Manager section in FollowUp',
      control: 'text',
    },
    fetchClients: {
      description: 'Consumer-supplied API call. If provided, this function will be used to fetch data instead of the static list.',
      table: { disable: true },
      control: false,
    },
    onSelectionChange: {
      description: 'Callback fired when the selection changes.',
      action: 'onSelectionChange',
    },
    loadingText: {
      description: 'Text to display while loading data.',
      control: 'text',
    },
    emptyStateText: {
      description: 'Text to display when no data is available.',
      control: 'text',
    },
    value: {
      description: 'The selected values',
      control: 'array',
    },
  },
} as Meta<typeof SelectDynamicMultiple>;
