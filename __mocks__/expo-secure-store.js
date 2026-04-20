const store = new Map();
const mock = {
  getItemAsync: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
  setItemAsync: jest.fn(async (k, v) => {
    store.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k) => {
    store.delete(k);
  }),
  __reset: () => store.clear(),
};
module.exports = mock;
