import React, { useEffect } from 'react';

import { createPortal } from 'react-dom';

// styles
import '../../styles/portal.scss';

// creates a div that will be appended to the HTML body
const createElement = (id: string, dataTestId: string, className: string) => {
  document.createElement('div');
  const element = document.createElement('div');
  element.id = id;
  if (className) {
    element.className = className;
  }
  document.body.appendChild(element);
  element.dataset.testid = dataTestId;

  return element;
};

// Required Props
interface PortalRequiredProps {
  id: string;
  children: React.ReactNode;
}

// Optional Props
interface PortalOptionalProps {
  'data-testid'?: string;
  className?: string;
}

// Combined required and optional props to build the full prop interface
export interface PortalProps extends PortalRequiredProps, PortalOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: PortalOptionalProps = {
  'data-testid': 'tecma-portal',
};

const Portal: React.FC<PortalProps> = ({ id, children, 'data-testid': dataTestId, className }) => {
  const portalContainer = document.getElementById(id) || createElement(id, dataTestId || '', className || '');

  /**
   * the following effect returns a clean-up function to be performed
   * on component unmount: removes the given portalContainer if empty.
   */
  useEffect(
    () => () => {
      if (portalContainer && portalContainer.innerHTML === '') {
        portalContainer.remove();
      }
    },
    [portalContainer],
  );

  return createPortal(children, portalContainer);
};

Portal.defaultProps = defaultProps;

/**
 *  This component create a React Portal
 * Each time the component mount, check if the div used to show the modal already exists
 * if it is so, this div will be reused otherwise another div will be created
 * Each time the component unmount, remove the modal div from the DOM
 */
export default React.memo(Portal);
