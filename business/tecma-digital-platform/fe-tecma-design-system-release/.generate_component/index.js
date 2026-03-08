const fs = require("fs");
const path = require("path");
const readline = require("readline/promises");
const { createComponentTestFile } = require("./templates/component_spec_template");
const { createComponentFile } = require("./templates/component_template");
const { createComponentIndexFile } = require("./templates/index_template");
const { createComponentScssFile } = require("./templates/scss_template");
const { updateSrcIndexFile } = require("./templates/src_index_template");

// ANSI Color Codes for Terminal Styling
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const BLUE = "\x1b[34m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";

async function generateComponent() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log(`${BOLD}${BLUE}Component Generator${RESET}`);
    console.log("──────────────────────────────");

    // Ask for component type
    console.log(`${BOLD}${BLUE}Select Component Type:${RESET}`);
    console.log(`  ${BOLD}${BLUE}1.${RESET} Component`);
    console.log(`  ${BOLD}${BLUE}2.${RESET} View`);
    console.log(`  ${BOLD}${BLUE}3.${RESET} Project Component`);

    const type = await rl.question(`Enter your choice (1, 2, or 3): `);
    if (!["1", "2", "3"].includes(type))
      throw new Error("Invalid selection. Please enter 1, 2, or 3.");

    const pathMap = { 1: "components", 2: "views", 3: "projectComponents" };
    const folder = pathMap[type];

    console.log(`${GREEN}✔ Selected type:${RESET} ${BOLD}${folder.toUpperCase()}${RESET}`);

    // Ask for component name
    const name = await rl.question(`${BOLD}Enter Component Name (camelCase if needed): ${RESET}`);
    if (!name) throw new Error("You must provide a component name.");
    const componentName = name.charAt(0).toUpperCase() + name.slice(1);

    // Ask for project name
    const project = await rl.question(`${BOLD}Enter Project Name: ${RESET}`);
    if (!project) throw new Error("You must provide a project name.");
    const prjName = project;

    rl.close();

    // Define paths
    const rootPath = process.cwd();
    const componentPath = path.join(rootPath, `src/${folder}/${componentName}/`);
    const stylePath = path.join(rootPath, "src/styles/");
    const testPath = path.join(rootPath, "src/__tests__/");

    // Ensure folders exist
    if (!fs.existsSync(componentPath)) fs.mkdirSync(componentPath, { recursive: true });
    if (!fs.existsSync(stylePath)) fs.mkdirSync(stylePath, { recursive: true });
    if (!fs.existsSync(testPath)) fs.mkdirSync(testPath, { recursive: true });

    const componentClassName = componentName.charAt(0).toLowerCase() + componentName.slice(1);

    console.log(`${GREEN}✔ Creating component structure...${RESET}`);

    // Create Component File
    fs.writeFileSync(
      path.join(componentPath, `${componentName}.tsx`),
      createComponentFile(componentName, prjName),
    );
    console.log(`${GREEN}✔ Created:${RESET} ${BOLD}${componentPath}${componentName}.tsx${RESET}`);

    // Create SCSS file inside src/styles
    fs.writeFileSync(
      path.join(stylePath, `${componentClassName}.scss`),
      createComponentScssFile(componentClassName, prjName),
    );
    console.log(`${GREEN}✔ Created:${RESET} ${BOLD}${stylePath}${componentClassName}.scss${RESET}`);

    // Create Test File inside src/__tests__
    fs.writeFileSync(
      path.join(testPath, `${componentName}.spec.tsx`),
      createComponentTestFile(componentName, prjName, componentClassName),
    );
    console.log(`${GREEN}✔ Created:${RESET} ${BOLD}${testPath}${componentName}.spec.tsx${RESET}`);

    // Create Component Index File
    fs.writeFileSync(path.join(componentPath, `index.ts`), createComponentIndexFile(componentName));
    console.log(`${GREEN}✔ Created:${RESET} ${BOLD}${componentPath}index.ts${RESET}`);

    // Update the src index file
    updateSrcIndexFile(folder, componentName);
    console.log(`${GREEN}✔ Updated:${RESET} ${BOLD}src/index.ts${RESET}`);

    console.log(`${BOLD}${GREEN}✔✔ Component "${componentName}" successfully created! 🎉${RESET}`);
  } catch (error) {
    console.error(`${BOLD}${RED}❌ Error:${RESET} ${error.message}`);
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Run the script
generateComponent();
