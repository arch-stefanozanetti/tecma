const addSiblings = (pagesArray: Array<number>, currentPage: number, totalPages: number, siblings: number) => {
  for (let i = 1; i <= siblings; i += 1) {
    // Insert pages before the currentPage
    if (currentPage - i > 1) {
      pagesArray.unshift(currentPage - i);
    }
    // Insert pages after the currentPage
    if (currentPage + i < totalPages) {
      pagesArray.push(currentPage + i);
    }
  }
  return pagesArray;
};

export const createPaginationArray = (pages: number, currentPage: number, siblings?: number) => {
  // Handle single page case
  if (pages <= 1) return [1];

  const paginationArray: Array<number | string> = [1, pages];
  // Insert the current page if not already included
  if (!paginationArray.includes(currentPage)) {
    paginationArray.splice(1, 0, currentPage);
  }
  if (siblings) {
    addSiblings(paginationArray as Array<number>, currentPage, pages, siblings);
  }

  // Sorting the array and handling the ellipsis
  paginationArray.sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : 0));
  const resultArray: Array<number | string> = [];
  for (let i = 0; i < paginationArray.length; i += 1) {
    if (i > 0 && (paginationArray[i] as number) - (paginationArray[i - 1] as number) > 1) {
      resultArray.push('...');
    }
    resultArray.push(paginationArray[i]);
  }

  return resultArray;
};
