/** Paginazione TECMA per liste servite in una singola pagina (tutto il result set). */
export const singlePagePaginationInfo = (totalDocs: number) => {
  if (totalDocs <= 0) {
    return {
      totalDocs: 0,
      page: 1,
      perPage: 10,
      totalPages: 0,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: null as number | null,
      nextPage: null as number | null,
    };
  }
  return {
    totalDocs,
    page: 1,
    perPage: totalDocs,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
    prevPage: null as number | null,
    nextPage: null as number | null,
  };
};
