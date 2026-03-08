import React from 'react';

import { DefaultProps } from '../../declarations/defaultProps';
import { goTo, onCardClick as defaultOnCardClick } from '../../helpers/sidebarUtils';
import { Button } from '../Button';
import { Card } from '../Card';
import { Icon } from '../Icon';

// styles
import '../../styles/sidebarBSSPlatformTools.scss';

interface ToolWithUrl {
  name: string;
  url: string;
}

interface Labels {
  title: string;
  bssPlatform: string;
}

export interface SidebarBSSPlatformToolsRequiredProps {
  tools: Array<ToolWithUrl>;
  imagesBaseUrl: string;
  bssPlatformLink: string;
  currentTool: string;
  labels: Labels;
}
interface SidebarBSSPlatformToolOptionalProps extends DefaultProps {
  onLinkClick?: (link: string) => void;
  onCardClick?: (toolName: string, currentTool: string, toolUrl: string) => void;
}

export interface SidebarBSSPlatformToolProps extends SidebarBSSPlatformToolsRequiredProps, SidebarBSSPlatformToolOptionalProps {}

const defaultProps: SidebarBSSPlatformToolOptionalProps = {
  className: 'tecma-SidebarBSSPlatformTools',
  id: undefined,
  style: undefined,
  'data-testid': 'tecma-SidebarBSSPlatformTools',
  onLinkClick: goTo,
  onCardClick: defaultOnCardClick,
};

export const SidebarBSSPlatformTools: React.FC<SidebarBSSPlatformToolProps> = ({
  tools,
  imagesBaseUrl,
  bssPlatformLink,
  currentTool,
  labels,
  onLinkClick,
  onCardClick,
  ...rest
}) => {
  const { className, ...props } = rest;
  return (
    <div className='tecma-SidebarBSSPlatformTools' {...props}>
      <div className='sidebarBSSPlatformTools-header'>
        {labels.title}
        <Button
          className='sidebarBSSPlatformTools-redirect-button'
          onClick={() => {
            if (onLinkClick) {
              onLinkClick(bssPlatformLink);
            }
          }}
        >
          {labels.bssPlatform}
          <Icon iconName='logout' className='sidebarBSSPlatformTools-redirect-button-icon' size='extra-small' />
        </Button>
      </div>
      {tools.map((tool) => (
        <Card
          key={tool.name}
          className='sidebarBSSPlatformTools-toolBox'
          orientation='horizontal'
          selected={tool.name === currentTool}
          setSelected={() => {
            if (onCardClick) {
              onCardClick(tool.name, currentTool, tool.url);
            }
          }}
        >
          <Card.Media className='sidebarBSSPlatformTools-card-media-override'>
            <img
              src={`${imagesBaseUrl}/${tool.name.toLowerCase()}.jpeg?v=${new Date().getDay()}`}
              alt={`${tool.name.toLowerCase()}`}
              className='sidebarBSSPlatformTools-toolImage'
            />
          </Card.Media>
          <Card.Content className='sidebarBSSPlatformTools-toolName'>{tool.name}</Card.Content>
        </Card>
      ))}
    </div>
  );
};

SidebarBSSPlatformTools.defaultProps = defaultProps as Partial<DefaultProps>;
