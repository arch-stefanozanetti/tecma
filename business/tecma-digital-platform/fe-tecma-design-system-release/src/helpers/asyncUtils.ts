export const delay = (fn: () => Promise<unknown>, time?: number) =>
  time
    ? new Promise((resolve) => {
        setTimeout(() => {
          fn().then((d) => resolve(d));
        }, time);
      })
    : Promise.resolve(fn());

export const wait = (millis?: number) =>
  millis
    ? new Promise((resolve) => {
        setTimeout(resolve, millis);
      })
    : Promise.resolve();
