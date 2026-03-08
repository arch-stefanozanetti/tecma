const fs = require("fs");
const readline = require("readline");
const { strToObj } = require("./strToObj");

/**
 * This function returns required, options and default props from the component.
 */
exports.getComponentProps = (componentName, subComponent) => {
  path = `./src/components/${componentName}/`;

  componentContent = subComponent
    ? fs.readFileSync(`${path}/${subComponent}.tsx`).toString()
    : fs.readFileSync(`${path}/${componentName}.tsx`).toString();

  componentProps = componentContent.substring(
    componentContent.toString().indexOf("interface"),
    componentContent.toString().indexOf(`const ${componentName}`),
  );

  requiredProps = componentProps.substring(0, componentProps.indexOf("}") + 1);
  componentContentWithoutRequiredProps = componentProps.split(requiredProps).pop();
  optionalProps = componentContentWithoutRequiredProps.substring(
    componentContentWithoutRequiredProps.indexOf("interface"),
    componentContentWithoutRequiredProps.indexOf("}") + 1,
  );
  componentContentWithoutOptionalProps = componentContentWithoutRequiredProps
    .split(optionalProps)
    .pop();
  defaultProps = componentContentWithoutOptionalProps.substring(
    componentContentWithoutOptionalProps.indexOf("defaultProps"),
    componentContentWithoutOptionalProps.length,
  );

  return {
    requiredProps: requiredProps ? strToObj(requiredProps) : "",
    optionalProps: optionalProps ? strToObj(optionalProps) : "",
    defaultProps: defaultProps ? strToObj(defaultProps, true) : "",
  };
};
