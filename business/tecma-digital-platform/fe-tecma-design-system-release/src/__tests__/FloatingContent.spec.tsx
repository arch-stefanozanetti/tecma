/* import React from "react"; */
import FloatingContent from '../components/_FloatingContent/FloatingContent';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-floatingContent',
};

describe('FloatingContent Component', () => {
  performStandardTest(FloatingContent, defaultProps, 'tecma-floatingContent');
});
