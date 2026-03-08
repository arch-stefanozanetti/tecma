import React from 'react';

import { render, screen } from '@testing-library/react';

import { SidebarBSSPlatformTools } from '../components/SidebarBSSPlatformTools';
import performStandardTest, { performTest } from '../helpers/performStandardTest';
import { goTo, onCardClick } from '../helpers/sidebarUtils';

const title = 'Passa a';
const bssPlatform = 'BSS Platform';
const currentTool = 'FollowUp';
const defaultProps = {
  'data-testid': 'tecma-SidebarBSSPlatformTools',
  labels: { title, bssPlatform },
  tools: [
    {
      name: currentTool,
      url: 'https://www.radomurl.it',
    },
    {
      name: 'Tool1',
      url: 'https://www.radomurl.it',
    },
    {
      name: 'Tool2',
      url: 'https://www.radomurl.it',
    },
    {
      name: 'Tool3',
      url: 'https://www.radomurl.it',
    },
  ],
  currentTool,
  imagesBaseUrl: '',
  bssPlatformLink: '',
  onLinkClick: goTo,
  onCardClick,
};

const checkDynamicClasses = (label: HTMLElement, parentClasses: string[] = []) => {
  expect(label).not.toBeNull();
  parentClasses.forEach((pClassName) => {
    expect(label.parentElement?.classList.contains(pClassName)).toBeTruthy();
  });
};

describe('SidebarBSSPlatformTools Component', () => {
  performStandardTest(SidebarBSSPlatformTools, defaultProps, 'tecma-SidebarBSSPlatformTools');

  performTest({
    description: 'should contain labels and tools passed as props',
    renderer: () => render(<SidebarBSSPlatformTools {...defaultProps} />),
    test: () => {
      const link = screen.getByText(bssPlatform);
      expect(screen.getByText(title)).not.toBeNull();
      expect(link).not.toBeNull();

      defaultProps.tools.forEach((tool) => {
        const isCurrentTool = tool.name === currentTool;
        const parentClass = isCurrentTool ? ['selected'] : [];
        checkDynamicClasses(screen.getByText(tool.name), parentClass);
      });
    },
    dataTestId: 'tecma-SidebarBSSPlatformTools',
  });
});
