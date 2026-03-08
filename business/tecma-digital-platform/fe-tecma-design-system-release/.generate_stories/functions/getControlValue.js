exports.getControlValue = (propType) => {
  if (propType === "string" || propType === "number") {
    return '"text"';
  }
  if (propType === "boolean") {
    return '"boolean"';
  }
  return "/* TODO add missing control */";
};
