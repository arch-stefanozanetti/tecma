const fs = require("fs");
const readline = require("readline");
const { getComponentProps } = require("./functions/getComponentProps");
const { createComponentStoriesFile } = require("./stories_template");

function writeFileErrorHandler(err) {
  if (err) throw err;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Write component name: ", (componentName) => {
  if (!componentName) {
    throw Error("Please provide a name");
  }
  libraryComponents = fs
    .readdirSync("./src/components", { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
  componentExist = libraryComponents.includes(componentName);
  parentComponentName = libraryComponents.filter((parentComponentName) =>
    componentName.includes(parentComponentName),
  )[0];

  if (!componentExist && parentComponentName === "") {
    throw Error(
      `The component ** ${componentName} ** doesn't exist or the componente name is not written properly.`,
    );
  }

  const { requiredProps, optionalProps, defaultProps } =
    !componentExist && parentComponentName !== ""
      ? getComponentProps(parentComponentName, componentName)
      : getComponentProps(componentName);

  rl.question("Please, add a component description: ", (componentDescription) => {
    rl.question("Please, provide the figma link for design: ", (figmaLink) => {
      //stories.tsx
      fs.writeFileSync(
        `${path}/${componentName}.stories.tsx`,
        createComponentStoriesFile(
          componentName,
          [...requiredProps, ...optionalProps],
          defaultProps,
          componentDescription,
          figmaLink
        ),
        writeFileErrorHandler,
      );

      rl.close();
    });
  });
});
