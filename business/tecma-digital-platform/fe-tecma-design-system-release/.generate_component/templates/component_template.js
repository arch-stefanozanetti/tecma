/**
 * This function exports the component basic structure.
 */

exports.createComponentFile = (name, prjName) => {
  const componentName = name.charAt(0).toUpperCase() + name.slice(1);
  const componentClassName = name.charAt(0).toLowerCase() + name.slice(1);
  const nextPrjName = prjName.charAt(0).toLowerCase() + prjName.slice(1);

  return `import React from "react";
import classNames from "classnames";
import { DefaultProps } from "../../utils/types";

// styles
import "../../styles/${componentClassName}.scss"; // Updated to global styles folder

// Required Props
interface ${componentName}RequiredProps {}

// Optional Props
interface ${componentName}OptionalProps extends DefaultProps {}

// Combined required and optional props to build the full prop interface
export interface ${componentName}Props extends ${componentName}RequiredProps, ${componentName}OptionalProps {}

// use the optional prop interface to define the default props
const defaultProps: ${componentName}OptionalProps = {
  "data-testid": "${nextPrjName}-${componentClassName}",
};

const ${componentName}: React.FC<${componentName}Props> = ({ className, ...rest }) => {
  const classList = classNames("${nextPrjName}-${componentClassName}", className);
  return (
    <div className={classList} {...rest}>
      Hello 👋, I am a ${componentName} component.
    </div>
  );
};

${componentName}.defaultProps = defaultProps as Partial<${componentName}OptionalProps>;

export default React.memo(${componentName});
`;
};
