// import React from "react";
import { Drawer } from '../components/Drawer/Drawer';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-drawer',
};

describe('Drawer Component', () => {
  performStandardTest(Drawer, defaultProps, 'tecma-drawer');
});
