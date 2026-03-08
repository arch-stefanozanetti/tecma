import React from 'react';

import { ComponentStory, ComponentMeta } from '@storybook/react';

import { SidebarBSSPlatformTools } from '../components/SidebarBSSPlatformTools';
import { BUCKET_BASEURL } from '../constants/general';
import { goTo, onCardClick } from '../helpers/sidebarUtils';

export default {
  title: 'Project Components/SidebarBSSPlatformTools',
  component: SidebarBSSPlatformTools,
  argTypes: {
    labels: {
      defaultValue: {
        title: 'passa a ',
        bssPlatform: 'BusinessPlatform',
      },
    },
    currentTool: { defaultValue: 'FollowUp' },
    bssPlatformLink: { defaultValue: '...' },
    tools: {
      defaultValue: [
        {
          name: 'ReCommerce',
          url: 'https://www.terrazzafedro.it',
        },
        {
          name: 'FollowUp',
          url: 'https://followup-biz-tecma-dev1.tecmasolutions.com?hostname=www.terrazzafedro.it',
        },
      ],
    },
    imagesBaseUrl: {
      defaultValue: `${BUCKET_BASEURL}/global/img/tools`,
    },
    // props added to make the storybook work, since it doesn't correctly take default values for functions
    onLinkClick: {
      defaultValue: goTo,
    },
    onCardClick: {
      defaultValue: onCardClick,
    },
  },
} as ComponentMeta<typeof SidebarBSSPlatformTools>;

export const Default: ComponentStory<typeof SidebarBSSPlatformTools> = (args) => {
  return <SidebarBSSPlatformTools {...args} />;
};
