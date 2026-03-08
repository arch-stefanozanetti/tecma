// import React from "react";
import { Tab } from '../components/Tab/Tab';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-tab',
};

describe('Tab Component', () => {
  performStandardTest(Tab, defaultProps, 'tecma-tab');
});
