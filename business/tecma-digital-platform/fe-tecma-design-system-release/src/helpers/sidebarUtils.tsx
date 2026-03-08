export const goTo = (url: string) => {
  window.open(url);
};
export const onCardClick = (name: string, currentTool: string, url: string) => {
  if (name !== currentTool) goTo(url);
};
