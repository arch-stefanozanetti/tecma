export const MOCK_REMOTE_URL = '/a/remote/url';
export const MOCK_LOCAL_URL = '/a/local/url';
export const MOCK_UNEXISTING_URL = '/an/url/that/does/not/exist';

const mockFetchText = async (text: string) => ({
  headers: {
    get: (header: string) => {
      if (header === 'content-type') {
        return 'image/svg+xml';
      }
      return null;
    },
  },
  text: async () => text,
});

export const mockFetchArrowUp = async () =>
  mockFetchText(`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M11.2929 6.79289C11.6834 6.40237 12.3166 6.40237 12.7071 6.79289L20.2071 14.2929C20.5976 14.6834 20.5976 15.3166 20.2071 15.7071C19.8166 16.0976 19.1834 16.0976 18.7929 15.7071L12 8.91421L5.20711 15.7071C4.81658 16.0976 4.18342 16.0976 3.79289 15.7071C3.40237 15.3166 3.40237 14.6834 3.79289 14.2929L11.2929 6.79289Z" fill="#262626"/>
</svg>
`);

export const mockFetchArrow = async () =>
  mockFetchText(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8.67 14.51"><g id="Livello_2__:r0:" data-name="Livello 2"><g id="Livello_1-2__:r0:" data-name="Livello 1"><polygon points="0 7.25 7.25 0 8.67 1.41 2.83 7.25 8.67 13.1 7.25 14.51 0 7.25"></polygon></g></g></svg>`,
  );

export const mockFetchSVG = async (url: string) => {
  if (url === `${MOCK_LOCAL_URL}/arrow-up.svg`) {
    const response = await mockFetchArrowUp();
    return response;
  }
  if (url === `${MOCK_REMOTE_URL}/arrow-left.svg`) {
    const response = await mockFetchArrow();
    return response;
  }
  return {
    headers: {
      get: () => '',
      status: 404,
    },
  };
};
