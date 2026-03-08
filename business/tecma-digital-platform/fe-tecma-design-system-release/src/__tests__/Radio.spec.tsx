// import React from "react";
import Radio from '../components/Radio/Radio';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-radio',
};

describe('Radio Component', () => {
  performStandardTest(Radio, defaultProps, 'tecma-radio');
});
