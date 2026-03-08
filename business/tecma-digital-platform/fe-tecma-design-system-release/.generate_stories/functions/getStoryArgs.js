exports.getStoryArgs = (propType, storyName, propName, propValue, children) => {
  if (propType === "boolean") {
    propValue = !propValue;
  }

  return propType === "string"
    ? `\n${storyName}.args = { ${propName}: "${propValue}"${children} };`
    : `\n${storyName}.args = { ${propName}: ${propValue}${children} };`;
};
