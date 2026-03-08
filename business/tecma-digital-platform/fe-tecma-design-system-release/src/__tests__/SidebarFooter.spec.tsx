// import React from "react";
import SidebarFooter from '../components/Sidebar/components/SidebarFooter/SidebarFooter';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-sidebarFooter',
};

describe('SidebarFooter Component', () => {
  performStandardTest(SidebarFooter, defaultProps, 'tecma-sidebarFooter');
});
