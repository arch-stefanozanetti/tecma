// import React from "react";
import RadioGroup from '../components/RadioGroup/RadioGroup';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-radioGroup',
};

describe('RadioGroup Component', () => {
  performStandardTest(RadioGroup, defaultProps, 'tecma-radioGroup');
});
