const fs = require("fs");
const readline = require("readline");

const rl = readline.createInterface({
  input: fs.createReadStream("./src/theme/utils/variables.scss"),
  output: process.stdout,
  console: false,
});

exports.generateStyle = () => {
  file = fs.readFileSync("./src/theme/utils/variables.scss", "utf-8");
  cssKeys = [...new Set(file.match(/\$[\w\d]+-/g))]
    .map((key) => key.slice(1, -1))
    .filter((key) => key !== "on");
  obj = {};
  cssKeys.forEach((key) => {
    file.split(/\r?\n/).forEach(function (line) {
      if (line.includes(key)) {
        lineKey = line.slice(0, line.indexOf(":"));
        lineValue = line.slice(line.indexOf(":") + 1, line.length - 1).trim();
        obj[key] = { ...obj[key], [lineKey]: lineValue };
      }
    });
  });

  string = "export const colors = {";
  Object.keys(obj).forEach(
    (key) => (string = string + `${key}: ${JSON.stringify(obj[key])},\n`),
  );
  return string + "}";
};
