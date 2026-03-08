// import React from "react";
import Searchbar from '../components/SearchBar/SearchBar';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-searchbar',
};

describe('Searchbar Component', () => {
  performStandardTest(Searchbar, defaultProps, 'tecma-searchbar');
});
