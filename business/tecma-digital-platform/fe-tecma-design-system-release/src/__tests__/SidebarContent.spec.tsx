// import React from "react";
import SidebarContent from '../components/Sidebar/components/SidebarContent/SidebarContent';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-sidebarContent',
};

describe('SidebarContent Component', () => {
  performStandardTest(SidebarContent, defaultProps, 'tecma-sidebarContent');
});
