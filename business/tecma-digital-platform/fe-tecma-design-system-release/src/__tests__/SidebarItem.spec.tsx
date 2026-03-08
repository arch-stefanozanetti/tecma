// import React from "react";
import SidebarItem from '../components/Sidebar/components/SidebarItem/SidebarItem';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-sidebarItem',
};

describe('SidebarItem Component', () => {
  performStandardTest(SidebarItem, defaultProps, 'tecma-sidebarItem');
});
