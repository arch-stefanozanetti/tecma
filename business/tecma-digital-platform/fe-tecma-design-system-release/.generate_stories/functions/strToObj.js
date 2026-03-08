/**
 * This function return an object composed by {propName:propValue} starting from a string
 */
const elaborateProp = (prop) => ({
  [prop.match(/(?=^)\w+(?=:)/g)]: prop.match(/ (.*)$/g)[0].trim(),
});

/**
 * This function return an array composed by every component prop ({propName: propValue}) providing even a description if present.
 */
const manipulateString = (string) => {
  stringsArray = string
    .trim()
    .slice(0, -1)
    .split(/,\s{2}/) //split by '//' keeping '//' needed to identify the prop description
    .map((el) => el.trim());
  //returns an array of object composed by the component props taken from the string passed as parameter
  return string === ""
    ? ""
    : stringsArray.map((el) => {
        if (el.includes("//")) {
          elements = el.split("  ");

          return {
            componentDescription: elements[0].slice(3, elements[0].length),
            ...elaborateProp(elements[1]),
          };
        } else {
          return elaborateProp(el);
        }
      });
};

/**
 * This function convert string to object
 */
exports.strToObj = (string, isDefaultProps) => {
  const nextString = string
    .substring(string.indexOf("{"), string.indexOf("}") + 1)
    .replace(/\n/g, "")
    .replace(/\?/g, "")
    .replace(/;/g, ",")
    .slice(1, -1);

  if (isDefaultProps) {
    const defaultPropsString = nextString.split(",").map((el) => el.trim());
    // remove last empty string
    defaultPropsString.pop();
    return defaultPropsString?.map((el) => ({
      [el.match(/(?=^)(\w|"(.*?)")+(?=:)/g)]: el
        .match(/ (.*)$/g)[0]
        .trim()
        .replaceAll('"', ""),
    }));
  }

  return manipulateString(nextString);
};
