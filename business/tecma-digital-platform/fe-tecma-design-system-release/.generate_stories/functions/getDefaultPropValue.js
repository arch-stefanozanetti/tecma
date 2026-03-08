/**
 * This function returns the defaultValue for each prop
 */
exports.getDefaultPropValue = (defaultProps, propType, propName) => {
  defaultValue = defaultProps?.find((el) => el[propName]);

  if (defaultValue === undefined) {
    if (propType === "string") {
      return '"hello"';
    }
    if (propType === "boolean") {
      return false;
    }
  } else if (propType !== "boolean") {
    return `"${defaultValue[propName]}"`;
  } else {
    return defaultValue[propName];
  }
  return "/* TODO add missing defaultValue or remove this fields */";
};
