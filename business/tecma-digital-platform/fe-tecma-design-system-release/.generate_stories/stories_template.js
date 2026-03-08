const { getControlValue } = require("./functions/getControlValue");
const { getDefaultPropValue } = require("./functions/getDefaultPropValue");
const { getStoryArgs } = require("./functions/getStoryArgs");

/**
 * This function create the component story file defining stories for each component's prop
 */
exports.createComponentStoriesFile = (name, props, defaultProps, componentDescription, figmaLink) => {
  stories = "";
  argTypes = "";

  props.forEach((prop) => {
    propName = Object.keys(prop).filter((el) => el !== "componentDescription")[0];

    if (propName !== "children") {
      basicPropType = {
        boolean: true,
        number: 1,
        string: "hello",
      };
      defaultPropValue = defaultProps.find((prop) => Object.keys(prop)[0] === propName)
        ? defaultProps.find((prop) => Object.keys(prop)[0] === propName)[propName]
        : undefined;

      propValue = basicPropType[prop[propName]] || defaultPropValue;

      storyName = propName.slice(0, 1).toUpperCase() + propName.slice(1, propName.length);
      storyExport = `\nexport const ${storyName} = Template.bind({});`;
      children = props.flatMap(Object.keys).includes("children") ? `, children: "${propName}"` : "";

      storyArgs = getStoryArgs(prop[propName], storyName, propName, propValue, children);

      storyComment =
        propValue === undefined ? ` // TODO: add correct type for ${prop[propName]}` : "";
      stories = stories + storyExport + storyArgs + storyComment;
    }

    defaultValue = defaultProps?.find((el) => el[propName]);
    description = prop.componentDescription
      ? `"${prop.componentDescription}"`
      : "/* TODO add missing description */";

    argsString = `\n    ${[propName]}: {
      description: ${description},
      defaultValue: ${getDefaultPropValue(defaultProps, prop[propName], propName)},
      control: ${getControlValue(prop[propName])},
      options: /* TODO add missing options or remove this fields */,
    },`;

    argTypes = argTypes + argsString;
  });

  return `import React from "react";
import { Story, Meta } from "@storybook/react";
import { ${name} } from ".";
import { ${name}Props } from "./${name}";

// 👇 We create a “template” of how args map to rendering
const Template: Story<${name}Props> = (args) => <${name} {...args} />;

// Stories
export const Basic = Template.bind({});
Basic.storyName = "Basic Usage";${stories}

export default {
  title: "Components/${name}",
  component: ${name},
  parameters: {
    componentSubtitle:
     "${componentDescription}",
    design: {
      type: "figma",
      url: "${figmaLink}",
    },
  },
  argTypes: {${argTypes}
  },
} as Meta<typeof ${name}>;
`;
};
