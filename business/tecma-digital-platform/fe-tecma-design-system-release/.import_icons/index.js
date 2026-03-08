const fs = require('fs');
const readline = require('readline');
const path = require('node:path');
const prettier = require('prettier');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ROOT_DIR = path.join(__dirname, '../');
const SVG_EXTENSION = '.svg';
const FILL_ICON_SUFFIX = '-filled';
const ICONS_DEST_DIR = path.join(ROOT_DIR, './src/components/Icon/svg/');
const ICONS_MANIFEST_PATH = path.join(ROOT_DIR, './src/components/Icon/icons-manifest.json');
const PRETTIER_CONFIG_PATH = path.join(ROOT_DIR, './prettier.config.js');
const ICON_TYPES_FILE_PATH = path.join(ROOT_DIR, './src/components/Icon/IconName.d.ts');

rl.question('Insert path of the icons folder you exported from Figma: ', async (srcFolder) => {
  const iconsSrcFolder = path.join(ROOT_DIR, srcFolder);
  if (!fs.existsSync(iconsSrcFolder)) {
    console.error(`Cannot find folder: "${iconsSrcFolder}"`);
    process.exit(1);
  }

  console.log(`Importing icons from folder ${iconsSrcFolder}`);

  console.log(`Delete old icons content "${ICONS_DEST_DIR}"`);

  clearDir(ICONS_DEST_DIR);

  let icons = [];

  const files = fs.readdirSync(iconsSrcFolder);

  files.forEach((iconFileName) => {
    if (isSVG(iconFileName)) {
      console.log(`Importing icon: ${iconFileName}`);
      const svgName = getSVGName(iconFileName);
      const iconName = replaceAll(svgName, ' ', '-').toLowerCase();
      if (isBaseIcon(iconName)) {
        console.log(`  Adding icon "${iconName}" to manifest`);
        icons.push(iconName);
      }
      console.log(`  Moving file "${iconFileName}" to icons folder`);
      const srcSVGPath = path.join(iconsSrcFolder, iconFileName);
      const dstSVGPath = path.join(ICONS_DEST_DIR, iconName + SVG_EXTENSION);
      fs.copyFileSync(srcSVGPath, dstSVGPath);
    } else {
      console.log(`  Skipping file "${iconFileName}" (not an SVG)`);
    }
  });

  console.log('Writing icons manifest');
  const manifestContent = JSON.stringify({ icons });
  fs.writeFileSync(ICONS_MANIFEST_PATH, await format(manifestContent, 'json'));

  console.log('Writing icons type files');
  const iconsTypesFileContent = generateIconsTypeFile(icons);
  fs.writeFileSync(ICON_TYPES_FILE_PATH, await format(iconsTypesFileContent));

  rl.close();
});

function isBaseIcon(iconName) {
  return !iconName.endsWith(FILL_ICON_SUFFIX);
}

function isSVG(fileName) {
  return fileName.endsWith(SVG_EXTENSION);
}

function getSVGName(fileName) {
  if (!isSVG(fileName)) {
    return null;
  }
  return fileName.slice(0, -SVG_EXTENSION.length);
}

function replaceAll(str, find, replace) {
  return str.split(find).join(replace);
}

function generateIconsTypeFile(icons) {
  return `export type IconName = ${icons.map((i) => `"${i}"`).join(' | ')};`;
}

function clearDir(dirName) {
  const files = fs.readdirSync(dirName);

  for (const file of files) {
    fs.unlink(path.join(dirName, file), (err) => {
      if (err) throw err;
    });
  }
}

async function format(string, parser) {
  const prettierBaseConfig = await prettier.resolveConfig(PRETTIER_CONFIG_PATH);
  const prettierConfig = {
    ...prettierBaseConfig,
    parser,
  };
  return prettier.format(string, prettierConfig);
}
