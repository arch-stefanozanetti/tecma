// import React from "react";
import TableMaterial from '../components/TableMaterial/TableMaterial';
import performStandardTest from '../helpers/performStandardTest';

const defaultProps = {
  'data-testid': 'tecma-tableMaterial',
};

describe('TableMaterial Component', () => {
  performStandardTest(TableMaterial, defaultProps, 'tecma-tableMaterial');
});
