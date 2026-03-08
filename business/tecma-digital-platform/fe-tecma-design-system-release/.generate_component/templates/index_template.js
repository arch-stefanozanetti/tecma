/**
 * This file exports the index file structure to export the component
 */
exports.createComponentIndexFile = (name) => {
  return `export { default as ${name} } from "./${name}";
`;
};
