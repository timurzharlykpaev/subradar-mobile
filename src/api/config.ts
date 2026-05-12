// Shared API config kept in its own module to avoid the require cycle
// that exists when both `api/client.ts` and `utils/errorReporter.ts` need
// the base URL — they used to import it from each other, and Metro
// flagged the cycle ("can result in uninitialized values"). Putting the
// constant here makes both consumers leaf-importers of the same config.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://api.subradar.ai/api/v1';
