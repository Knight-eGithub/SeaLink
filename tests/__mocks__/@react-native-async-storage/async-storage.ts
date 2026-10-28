const store = new Map<string, string>();

const AsyncStorageMock = {
  getItem: jest.fn(async (key: string) => {
    return store.get(key) ?? null;
  }),
  setItem: jest.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    store.delete(key);
  }),
  clear: jest.fn(async () => {
    store.clear();
  }),
  getAllKeys: jest.fn(async () => {
    return Array.from(store.keys());
  }),
};

export default AsyncStorageMock;
