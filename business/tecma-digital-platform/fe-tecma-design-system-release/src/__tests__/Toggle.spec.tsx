// import React from "react";
import Toggle from '../components/Toggle/Toggle';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-toggle',
};

describe('Toggle Component', () => {
  performStandardTest(Toggle, defaultProps, 'tecma-toggle');
});
