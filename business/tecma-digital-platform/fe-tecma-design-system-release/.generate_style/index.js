const fs = require("fs");
const readline = require("readline");
const { generateStyle } = require("./generateStyle");

function writeFileErrorHandler(err) {
  if (err) throw err;
}

fs.writeFileSync("./src/designToken/styles.ts", generateStyle(), writeFileErrorHandler);
