import React, { useState } from 'react';

import classNames from 'classnames';

import { Accordion } from '../Accordion';
import { Icon } from '../Icon';

import type { DefaultProps } from '../../declarations';
import type { IconName } from '../Icon/IconName';

// Required Props
interface DrawerAccordionRequiredProps {
  children: React.ReactNode;
}

// Optional Props
interface DrawerAccordionOptionalProps extends DefaultProps {
  headerIcon?: IconName;
  headerLabel?: string;
}

// Combined required and optional props to build the full prop interface
export interface DrawerAccordionProps extends DrawerAccordionRequiredProps, DrawerAccordionOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: DrawerAccordionOptionalProps = {
  'data-testid': 'tecma-drawerAccordion',
};

const DrawerAccordion: React.FC<DrawerAccordionProps> = ({ headerIcon, headerLabel, className, children, ...rest }) => {
  const classList = classNames('tecma-drawerAccordion', className);
  const [isOpen, setIsOpen] = useState<number>(-1);

  const handleClick = () => (isOpen === -1 ? setIsOpen(0) : setIsOpen(-1));

  return (
    <Accordion openPanels={isOpen} onClick={handleClick} className={classList}>
      <Accordion.Content
        headerComponent={
          <>
            {headerIcon && <Icon iconName={headerIcon} size='medium' />}
            <span className='header-label'>{headerLabel}</span>
            <Icon iconName={isOpen ? 'chevron-down' : 'chevron-up'} />
          </>
        }
        {...rest}
      >
        {children}
      </Accordion.Content>
    </Accordion>
  );
};

DrawerAccordion.defaultProps = defaultProps as Partial<DrawerAccordionOptionalProps>;

export default React.memo(DrawerAccordion);
