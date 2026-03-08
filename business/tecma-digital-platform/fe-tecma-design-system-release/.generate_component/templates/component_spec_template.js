/**
 * This function exports the structure of the component's spec file.
 */
exports.createComponentTestFile = (name, prjName, scssClassName) => {
  return `import React from "react";
import ${name} from "../components/${name}"; 
import performStandardTest from "../utils/functions/performStandardTest";

const defaultProps = {
  "data-testid": "${prjName}-${scssClassName}",
};

describe("${name} Component", () => {
  performStandardTest(${name}, defaultProps, "${prjName}-${scssClassName}");
});
`;
};
