// import React from "react";
import ProgressBar from '../components/ProgressBar/ProgressBar';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-progressBar',
};

describe('ProgressBar Component', () => {
  performStandardTest(ProgressBar, defaultProps, 'tecma-progressBar');
});
