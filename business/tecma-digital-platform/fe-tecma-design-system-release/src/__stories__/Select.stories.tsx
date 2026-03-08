import React, { useState } from 'react';

import { Story, Meta } from '@storybook/react';

import { IconName } from '../components/Icon/IconName';
import Select, { OptionSelect, SelectProps } from '../components/Select/Select';
import { DeviceContext } from '../context/device';

const options: OptionSelect[] = [
  { value: 'user', label: 'Chrome Chrome Chrome', icon: 'chrome' },
  { value: 'user1', label: 'Safari', icon: 'safari' },
  { value: 'user2', label: 'Edge', icon: 'microsoft-edge' },
  { value: 'user3', label: 'Firefox', icon: 'firefox', disabled: true },
  { value: 'user4', label: 'Non lo so' },
  { value: 'user5', label: 'TEST' },
  { value: 'user6', label: 'TEST 2' },
  { value: 'user7', label: 'TEST 3', email: 'test@test.it' },
  { value: 'user7', label: 'TEST 3', email: 'test@test.it' },
  { value: 'user7', label: 'TEST 3', email: 'test@test.it' },
  { value: 'user7', label: 'TEST 3', email: 'test@test.it' },
];

// 👇 We create a “template” of how args map to rendering
export const Template: Story<SelectProps> = (args) => {
  const { value } = args;
  const [choices, setChoices] = useState<OptionSelect[]>(value as OptionSelect[]);

  const handleOnChange = (newValue: OptionSelect[] | OptionSelect) => {
    setChoices(newValue as OptionSelect[]);
  };
  return (
    <DeviceContext>
      <Select
        {...args}
        options={options}
        disabledOptionTooltip='This option is disabled'
        allowDisabledOptionSelection
        helpText='This is a help text'
        value={choices}
        onChange={handleOnChange}
        warning
      />
    </DeviceContext>
  );
};

Template.storyName = 'Basic Usage';

// Storie
export const MultipleSelection: Story<SelectProps> = () => {
  const [value, setValue] = useState<OptionSelect[] | OptionSelect>([options[0]]);
  return <Select isMulti options={options} value={value as OptionSelect[]} onChange={setValue} />;
};
MultipleSelection.storyName = 'Multi select';
MultipleSelection.parameters = {
  docs: {
    description: {
      story: 'Support multiple selected options',
    },
  },
};

export const SearchableSelect: Story<SelectProps> = () => {
  const [value, setValue] = useState<OptionSelect[] | OptionSelect>([]);
  return <Select isSearchable options={options} value={value as OptionSelect[]} onChange={setValue} />;
};
SearchableSelect.storyName = 'Searchable';
SearchableSelect.parameters = {
  docs: {
    description: {
      story: 'Whether to enable search functionality',
    },
  },
};

export const ClearableSelect: Story<SelectProps> = () => {
  const [value, setValue] = useState<OptionSelect[] | OptionSelect>([options[0]]);
  return <Select isClearable options={options} value={value as OptionSelect[]} onChange={setValue} />;
};
ClearableSelect.storyName = 'Clearable';
ClearableSelect.parameters = {
  docs: {
    description: {
      story: 'Is the select value clearable',
    },
  },
};

export const LoadingSelect: Story<SelectProps> = () => {
  const [value, setValue] = useState<OptionSelect[] | OptionSelect>([]);
  return <Select isLoading options={[]} value={value as OptionSelect[]} onChange={setValue} />;
};
LoadingSelect.storyName = 'Loading state';
LoadingSelect.parameters = {
  docs: {
    description: {
      story: 'Is the select in a state of loading',
    },
  },
};

export const SortedSelect: Story<SelectProps> = () => {
  const [value, setValue] = useState<OptionSelect[] | OptionSelect>([options[0]]);
  return <Select sortBySelectedOptions isMulti options={options} value={value as OptionSelect[]} onChange={setValue} />;
};
SortedSelect.storyName = 'Selected sorted';
SortedSelect.parameters = {
  docs: {
    description: {
      story: 'Indicates if items in a list are sorted by selected values',
    },
  },
};

export default {
  title: 'Components/Select',
  component: Select,
  decorators: [
    (StoryComponent) => (
      <div style={{ margin: '10rem' }}>
        <StoryComponent />
      </div>
    ),
  ],
  parameters: {
    componentSubtitle:
      'A form input used for selecting a value: when collapsed it shows the currently selected option and when expanded, it shows a scrollable list of predefined options for the user to choose from.',
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/rbx5x46IADVyZ9VKqbhaZa/branch/Hp68mAmEVlPECLMUR5amWR/MOCKUP-BSS-TICKET?type=design&node-id=3950%3A6852&mode=design&t=CePXX5SXtngvh7Xj-1',
    },
  },
  argTypes: {
    value: {
      description: 'The selected values',
      control: 'array',
    },
    options: {
      description: 'The select options',
      control: 'array',
    },
    isRequired: {
      description: 'Indicate if this field is required',
      control: 'boolean',
    },
    label: {
      description: 'Label to assign to this select',
      control: 'text',
    },
    extraLabel: {
      description: 'Extra label to assign to this select',
      control: 'text',
    },
    isSearchable: {
      description: 'Indicate if show input field for search through possible options',
      control: 'boolean',
    },
    onChange: {
      description: 'The action to perform on input change',
      action: 'clicked',
    },
    defaultValue: {
      description: 'The default option selected that cant be deselect',
      control: 'array',
    },
    placeholder: {
      description: 'The select placeholder',
      control: 'text',
    },
    fluid: {
      description: "If true, the select is as wide as it's container",
      control: 'boolean',
    },
    searchPlaceholder: {
      description: 'The input text search placeholder',
      control: 'text',
    },
    noOptionsMessage: {
      description: 'The text to show when no option is available',
      control: 'text',
    },
    isMulti: {
      description: 'Defines if it is possible to select multiple options',
      control: 'boolean',
    },
    isLoading: {
      description: 'Set if the select is in loading mode for retrieve async options',
      control: 'boolean',
    },
    error: {
      description: 'Set if select is in error state',
      control: 'boolean',
    },
    sortBySelectedOptions: {
      description: 'Set if put on the top of the menu list the selected options',
      control: 'boolean',
    },
    hideSelectedOptions: {
      description: 'Set if hide selected options in the menu list',
      control: 'boolean',
    },
    isClearable: {
      description: 'Set if the select input could be cleared',
      control: 'boolean',
    },
    closeMenuOnSelect: {
      description: 'Set if the menu closed when user click an option from the list',
      control: 'boolean',
    },
    maxItemSelectedToShow: {
      description: 'Set how many items selected to show in multi mode ',
      control: 'number',
    },
    helpText: {
      description: 'The text to show when input is errored',
      control: 'text',
    },
    name: {
      description: 'The name that identify the element in a form',
      control: 'text',
    },
    showSelectedItemRemoveIcon: {
      description: 'Defines if the selected items should vae the remove icon',
      control: 'boolean',
    },
    dataTestId: {
      description: 'The attribute for test purpose only',
      control: 'text',
    },
  },
  args: {
    isRequired: false,
    value: [{ value: 'user' as IconName, label: 'Chrome', icon: 'chrome' }],
    placeholder: 'Select one option...',
    searchPlaceholder: 'Search item...',
    noOptionsMessage: 'No options',
    isMulti: true,
    fluid: false,
    error: false,
    isLoading: false,
    hideSelectedOptions: false,
    isClearable: false,
    closeMenuOnSelect: false,
    sortBySelectedOptions: false,
    isSearchable: true,
    defaultValue: [],
    helpText: '',
    maxItemSelectedToShow: 3,
    showSelectedItemRemoveIcon: true,
  },
} as Meta<typeof Select>;
