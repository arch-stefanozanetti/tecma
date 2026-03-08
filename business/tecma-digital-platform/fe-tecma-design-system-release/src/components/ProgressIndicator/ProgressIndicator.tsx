import React from 'react';

import classNames from 'classnames';

import { DefaultProps } from '../../declarations';
import { ProgressBar } from '../ProgressBar';

// styles
import '../../styles/progressIndicator.scss';

// Required Props
interface ProgressIndicatorRequiredProps {
  steps: number;
  currentStep: number;
  valueProgressBar: number;
}

// Optional Props
interface ProgressIndicatorOptionalProps extends DefaultProps {
  valueToShow?: boolean; // TODO: find better name
}

// Combined required and optional props to build the full prop interface
export interface ProgressIndicatorProps extends ProgressIndicatorRequiredProps, ProgressIndicatorOptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: ProgressIndicatorOptionalProps = {
  'data-testid': 'tecma-progressIndicator',
  valueToShow: false,
};

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ className, steps, currentStep, valueProgressBar, valueToShow, ...rest }) => {
  const classList = classNames('tecma-progressIndicator', className);

  const progressBarValue = (step: number) => {
    if (step === currentStep) {
      return valueProgressBar;
    }
    if (step < currentStep) {
      return 100;
    }
    return 0;
  };

  return (
    <div className={classList} {...rest}>
      {valueToShow && (
        <p className='value'>
          {currentStep} / {steps}
        </p>
      )}
      {Array.from(Array(steps).keys()).map((index) => {
        const step = index + 1;
        return (
          <div key={step} className={`stepProgressBar ${step === currentStep ? 'currentStep' : ''}`}>
            <ProgressBar value={progressBarValue(step)} />
          </div>
        );
      })}
    </div>
  );
};

ProgressIndicator.defaultProps = defaultProps as Partial<ProgressIndicatorOptionalProps>;

export default React.memo(ProgressIndicator);
