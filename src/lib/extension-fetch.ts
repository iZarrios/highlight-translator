export type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Chromium's worker fetch implementation requires its global receiver.
 * Calling a stored reference directly can throw `TypeError: Illegal invocation`.
 */
export const extensionFetch: Fetcher = (input, init) =>
  globalThis.fetch(input, init);
