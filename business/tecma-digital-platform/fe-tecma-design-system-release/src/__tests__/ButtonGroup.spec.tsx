// import React from "react";
import ButtonGroup from '../components/ButtonGroup/ButtonGroup';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-buttonGroup',
};

describe('ButtonGroup Component', () => {
  performStandardTest(ButtonGroup, defaultProps, 'tecma-buttonGroup');
});
