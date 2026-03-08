import React, { useCallback, useState } from 'react';

import { Story, Meta } from '@storybook/react';

import Icon, { IconProps, IconURLContext } from '../components/Icon/Icon';
import { IconName } from '../components/Icon/IconName';
import { icons as ICONS } from '../components/Icon/icons-manifest.json';
import { Toggle } from '../components/Toggle';
import { BUCKET_BASEURL, ICONS_BUCKET_URL_BASEPATH, ICONS_BUCKET_URL_TRAIL } from '../constants/general';

const ICONS_NAMES = ICONS.map((fileName: string) => fileName.replace('.svg', ''));

const INITIATIVES = ['Parco Vittoria - Flat Tower'];

const getBucketURL = (initiative: string) =>
  `${BUCKET_BASEURL}${ICONS_BUCKET_URL_BASEPATH}${encodeURI(initiative)}${ICONS_BUCKET_URL_TRAIL}`;

// 👇 We create a “template” of how args map to rendering
const Template: Story<IconProps> = ({ iconName, ...args }: { iconName: string }) => (
  <IconURLContext.Provider value={getBucketURL(INITIATIVES[0])}>
    <Icon {...args} iconName={iconName as IconName} className='test-class' />
  </IconURLContext.Provider>
);

export const Basic = Template.bind({});
Basic.storyName = 'Basic Usage';

export const IconsLibrary = ({ initiative, ...args }: { initiative: string }) => {
  const [searchValue, setSearchValue] = useState<string>('');
  const [filled, setFilled] = useState<boolean>(false);

  const handleInputChange = useCallback((event: React.FormEvent<HTMLInputElement>) => {
    setSearchValue(event.currentTarget.value);
  }, []);

  return (
    <IconURLContext.Provider value={initiative && getBucketURL(initiative)}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {/* TODO: replace with library input */}
        <input type='text' value={searchValue} onChange={handleInputChange} placeholder='Search icons' />
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Toggle onChange={() => setFilled(!filled)} value={filled} style={{ marginLeft: '1rem' }} />
          <span>Filled</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', marginTop: 30 }}>
        {ICONS_NAMES.filter((iconName: string) => iconName.includes(searchValue)).map((iconName: string) => (
          <div
            key={iconName}
            style={{
              width: 100,
              height: 100,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon {...args} iconName={iconName as IconName} filled={filled} />
            <span style={{ marginTop: 10 }}>{iconName}</span>
          </div>
        ))}
      </div>
    </IconURLContext.Provider>
  );
};
IconsLibrary.argTypes = {
  iconName: {
    control: false,
  },
  filled: {
    control: 'boolean',
    defaultValue: false,
  },
  initiative: {
    control: 'select',
    options: [null, ...INITIATIVES],
    defaultValue: null,
  },
};

export default {
  title: 'Components/Icon',
  component: Icon,
  args: {
    iconName: 'arrow',
  },
  argTypes: {
    iconName: {
      control: 'select',
      options: ['arrow', 'arrowup', 'nonExisting'],
    },
    src: {
      defaultValue: '',
    },
    'data-testid': {
      defaultValue: '',
    },
    filled: {
      control: 'boolean',
      defaultValue: false,
    },
    isLogo: {
      control: 'boolean',
      defaultValue: false,
    },
  },
} as Meta<typeof Icon>;
