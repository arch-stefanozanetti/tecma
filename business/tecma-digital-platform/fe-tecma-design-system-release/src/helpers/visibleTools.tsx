import * as constants from '../constants/SidebarBSSPlatformToolsConstants';

interface Product {
  name: string;
  label?: string;
  title?: string;
  default: boolean;
  roles: Array<string>;
}

interface Tool {
  name: string;
  version?: string;
  url: string;
  enabled: boolean;
}

const matchingTool = (product: Product, enabledTools: Array<Tool>) => {
  // in some configurations, the EMOTIONS tool is called NEUROSALES
  return enabledTools.find(
    (tool) => tool.name === product.name || (tool.name === constants.NEUROSALES && product.name === constants.EMOTIONS),
  );
};

export const visibleTools = (products: Array<Product>, enabledTools: Array<Tool>, userRole: string, currentTool: string) => {
  const filteredProducts = products.filter((product) => {
    const tool = matchingTool(product, enabledTools);

    // if the link doesn't exist, return false
    if (tool && (!tool.url || tool.url === '')) return false;

    // if the user doesn't have the grant to access the tool, return false
    if (product.roles.filter((role) => role === userRole).length === 0) return false;
    // if the selected tool is configured with enabled=true or undefined, return true
    if (tool && tool.enabled !== false) return true;

    // if the tool is not configured return false
    return false;
  });
  const toolsWithUrl = filteredProducts.map((product) => {
    const tool = matchingTool(product, enabledTools);
    return { name: product.name, url: tool && tool.url ? tool.url : '' };
  });
  // put currentTool to the top of the list
  const currentToolIndex = toolsWithUrl.findIndex((tool) => tool.name === currentTool);
  if (currentToolIndex !== -1) {
    const firstTool = toolsWithUrl[currentToolIndex];
    toolsWithUrl.splice(currentToolIndex, 1);
    toolsWithUrl.unshift(firstTool);
  }
  return toolsWithUrl;
};
