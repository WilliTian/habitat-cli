export type MutationQueue = <T>(operation: () => Promise<T>) => Promise<T>;

export function createMutationQueue(): MutationQueue {
  let tail: Promise<unknown> = Promise.resolve();

  return <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation, operation);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
