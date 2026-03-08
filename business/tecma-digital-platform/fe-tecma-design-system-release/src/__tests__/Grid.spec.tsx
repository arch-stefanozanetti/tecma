// import React from "react";
import { Grid } from '../components/Grid';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-grid',
};

describe('Grid Component', () => {
  performStandardTest(Grid, defaultProps, 'tecma-grid');
});
