import React from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations/defaultProps';

// styles
import '../../styles/progressBar.scss';

// Required Props
interface ProgressBarRequiredProps {
  // The progress bar value
  value: number;
}

// Optional Props
interface ProgressBarOptionalProps extends DefaultProps {
  // The value to show over the progress bar
  valueToShow?: string;
}

// Combined required and optional props to build the full prop interface
export interface ProgressBarProps extends ProgressBarRequiredProps, ProgressBarOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: ProgressBarOptionalProps = {
  'data-testid': 'tecma-progressBar',
};

const ProgressBar: React.FC<ProgressBarProps> = ({ value, valueToShow, className, ...rest }) => {
  const classList = classNames('tecma-progressBar', className);

  return (
    <div className={classList} {...rest}>
      <div className='progressBar' style={{ width: `${value}%` }} />
      {valueToShow && <span className='progressBar-value'>{valueToShow}</span>}
    </div>
  );
};

ProgressBar.defaultProps = defaultProps as Partial<ProgressBarOptionalProps>;

/**
 * A horizontal bar indicating the current completion status of a long-running task, usually updated continuously as the task progresses, instead of in discrete steps.
 */
export default React.memo(ProgressBar);
