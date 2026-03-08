/**
 * This function export the scss file structure
 */
exports.createComponentScssFile = (name, prjName) => {
  const nextPrjName = prjName.slice(0, 1).toLowerCase() + prjName.slice(1, prjName.length);

  return `@use "theme/utils/variables" as *;

.${nextPrjName}-${name}{

}`;
};
