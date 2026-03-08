const fs = require("fs");

exports.updateSrcIndexFile = (folder, componentName) => {
  const indexPath = "./src/index.ts";

  // Ensure the file exists
  if (!fs.existsSync(indexPath)) {
    console.warn(`⚠️ Warning: src/index.ts does not exist. Creating a new one.`);
    fs.writeFileSync(
      indexPath,
      "// COMPONENTS\n\n// VIEWS\n\n// PROJECT COMPONENTS\n\n// FUNCTIONS\n",
    ); // Create base sections
  }

  let fileContent = fs.readFileSync(indexPath, "utf-8").trim();

  // Define the appropriate section header
  const sectionHeaders = {
    components: "// COMPONENTS",
    views: "// VIEWS",
    projectComponents: "// PROJECT COMPONENTS",
    functions: "// FUNCTIONS",
  };

  const sectionHeader = sectionHeaders[folder];
  if (!sectionHeader) {
    console.error(`❌ Error: Unknown folder type "${folder}"`);
    return;
  }

  const newExport = `export { ${componentName} } from "./${folder}/${componentName}";\n`;

  // Prevent duplicate exports
  if (fileContent.includes(newExport.trim())) {
    console.warn(`⚠️ Warning: ${componentName} is already exported in src/index.ts`);
    return;
  }

  // Find the section to insert the new export
  const sectionIndex = fileContent.indexOf(sectionHeader);

  if (sectionIndex === -1) {
    console.error(`❌ Error: Section "${sectionHeader}" not found in src/index.ts`);
    return;
  }

  // Find the next section after the current one to insert in the right place
  const nextSectionIndex =
    Object.values(sectionHeaders)
      .map((header) => fileContent.indexOf(header))
      .filter((index) => index > sectionIndex) // Get only sections appearing after the current one
      .sort((a, b) => a - b)[0] || fileContent.length; // Find the closest section or use end of file

  const before = fileContent.substring(0, nextSectionIndex).trim();
  const after = fileContent.substring(nextSectionIndex).trim();

  // Insert new export in the right section
  fileContent = `${before}\n${newExport}\n${after}`;

  // Write back to the file
  fs.writeFileSync(indexPath, fileContent.trim() + "\n"); // Ensure trailing newline
};
