export const groupArray = (arr: [unknown], size: number) => {
  const nextArr = [];
  const currArr = arr.map((e) => e);
  if (size === 1) {
    return arr;
  }

  for (let i = 0; i < Math.ceil(currArr.length / size); i += 1) {
    // as never has been added as temporary fix after ts update to 5 version
    nextArr.push(arr.splice(0, size) as never);
  }
  return nextArr;
};
