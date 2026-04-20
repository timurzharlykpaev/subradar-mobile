const store = new Map();
const AsyncStorage = {
  getItem: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
  setItem: jest.fn(async (k, v) => {
    store.set(k, v);
  }),
  removeItem: jest.fn(async (k) => {
    store.delete(k);
  }),
  clear: jest.fn(async () => {
    store.clear();
  }),
  getAllKeys: jest.fn(async () => Array.from(store.keys())),
  multiGet: jest.fn(async (keys) => keys.map((k) => [k, store.has(k) ? store.get(k) : null])),
  multiSet: jest.fn(async (pairs) => {
    pairs.forEach(([k, v]) => store.set(k, v));
  }),
  multiRemove: jest.fn(async (keys) => {
    keys.forEach((k) => store.delete(k));
  }),
};
Object.defineProperty(exports, '__esModule', { value: true });
exports.default = AsyncStorage;
exports.__reset = () => store.clear();
