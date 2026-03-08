/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-proto */
/* eslint-disable max-classes-per-file */

/**
 * Mock object for global `Image` constructor. This will immediately resolve to a fulfilled state so
 * that the `onload` callback will always be invoked.
 */
export class MockImageSuccess {
  public src?: string;

  set onload(fn: () => void) {
    this.internalPromise.then(fn);
  }

  public onerror?: () => void;

  public internalPromise: Promise<unknown>;

  public constructor() {
    this.internalPromise = Promise.resolve();
  }
}

/**
 * Mock object for global `Image` constructor. This will immediately resolve to a rejected state so
 * that the `onerror` callback will always be invoked.
 */
export class MockImageError {
  public src?: string;

  public onload?: () => void;

  set onerror(fn: () => void) {
    this.internalPromise.catch(fn);
  }

  private internalPromise: Promise<unknown>;

  public constructor() {
    this.internalPromise = Promise.reject();
  }
}

/**
 * Mock object for global `Image` constructor. This will not go in a resolved or error state.
 * `onload` and `onerror` methods will not be invoked.
 */
export class MockImageLoad {
  public src?: string;

  public onload?: () => void;

  public onerror?: () => void;

  private internalPromise: Promise<unknown>;

  public constructor() {
    this.internalPromise = new Promise(() => {});
  }
}
