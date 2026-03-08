// import React from "react";
import Popover from '../components/Popover/Popover';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-popover',
};

describe('Popover Component', () => {
  performStandardTest(Popover, defaultProps, 'tecma-popover');
});
