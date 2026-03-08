// import React from "react";
import ProgressIndicator from '../components/ProgressIndicator/ProgressIndicator';
import performStandardTest from '../helpers/performStandardTest';

describe('ProgressIndicator Component', () => {
  const progressIndicatorProps = {
    steps: 3,
    currentStep: 2,
    valueProgressBar: 50,
    valueToShow: false,
    'data-testid': 'tecma-progressIndicator',
  };

  performStandardTest(ProgressIndicator, progressIndicatorProps, 'tecma-progressIndicator');
});
