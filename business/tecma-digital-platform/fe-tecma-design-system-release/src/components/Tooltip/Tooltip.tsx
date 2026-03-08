import React from 'react';

import MaterialTooltip, { TooltipProps as MaterialTooltipProps } from '@mui/material/Tooltip';
import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';
import { MuiPlacement } from '../../declarations/position';

// styles
import '../../styles/tooltip.scss';

// Required Props
interface TooltipRequiredProps {}

// Optional Props
interface TooltipOptionalProps extends DefaultProps {
  placement?: MuiPlacement;
  followCursor?: boolean;
}

// Combined required and optional props to build the full prop interface
export interface TooltipProps extends MaterialTooltipProps, TooltipRequiredProps, TooltipOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: TooltipOptionalProps = {
  placement: 'bottom',
  followCursor: false,
  'data-testid': 'tecma-tooltip',
};

/**
 * A means of displaying a description or extra information about an element, usually on hover, but can also be on click or tap.
 */
const Tooltip: React.FC<TooltipProps> = ({ title, children, className, ...rest }) => {
  const classList = classNames('tecma-tooltip', className);

  return (
    <MaterialTooltip title={title} {...rest} classes={{ tooltip: classList }}>
      {children}
    </MaterialTooltip>
  );
};

Tooltip.defaultProps = defaultProps as Partial<TooltipOptionalProps>;

export default React.memo(Tooltip);
