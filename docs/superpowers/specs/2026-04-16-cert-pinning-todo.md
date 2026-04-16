# Certificate Pinning — TODO Plan

Status: NOT IMPLEMENTED — requires native build, tracked for next EAS dev-build cycle.

## Why
Without pinning, a compromised or misissued CA / rogue corporate proxy / TLS-
intercepting malware on-device can silently MITM all `api.subradar.ai` traffic
including auth tokens, subscription data, and payment metadata. Pinning removes
trust from the entire CA pool and anchors trust to our own public key(s).

## Scope
Pin TLS for:
- `api.subradar.ai` (primary)
- `api-dev.subradar.ai` (optional — only if shipping dev builds)

Do NOT pin:
- Third-party domains (icon.horse, app stores, RevenueCat, Google/Apple auth)
- OTA update endpoints

## Library options

### Option A — `react-native-ssl-pinning` (recommended)
- Active community fork, simple `fetch`-compatible API.
- Works on iOS + Android.
- Integrates with axios via custom adapter.

### Option B — `@mattrglobal/pinch`
- More actively maintained fork of `react-native-pinch`.
- Same pattern: provide cert file, all requests enforce pin.

### Option C — custom native module
- Overkill for current scope. Skip.

## Implementation outline

1. Install library (in a dev build, NOT Expo Go):
   ```
   npx expo install react-native-ssl-pinning
   ```
2. Add native plugin to `app.json` `plugins` array so EAS auto-links on build.
3. Export both the current leaf cert public key and a backup (next rotation)
   as `.cer` files committed under `assets/certs/`.
4. Replace the axios instance in `src/api/client.ts` with a wrapper that
   delegates to `fetch` from `react-native-ssl-pinning` for `api.subradar.ai`
   host only. Keep axios interceptors for 401/refresh — just pass the pinned
   fetch as adapter.
5. On pin validation failure: hard fail, show user-friendly "Network error"
   UI, log event `security.cert_pin_failure` (both to analytics and Sentry).
6. Verify with `mitmproxy` running as MITM: app must refuse to connect.

## Rollout checklist
- [ ] Extract and commit cert pins
- [ ] Add `react-native-ssl-pinning` in dev build
- [ ] Replace axios transport
- [ ] Add analytics event + Sentry breadcrumb for pin failure
- [ ] Manual MITM test with mitmproxy
- [ ] Document pin rotation procedure (when backend renews cert)

## Operational notes
Pin rotations are risky — if we ship a build with an outdated pin and the
cert rotates, the entire app fleet becomes unable to reach the backend until
an OTA update lands. Mitigations:
- Always pin two keys: current + next.
- Set a reasonable `max-age` on the pinned set.
- Pre-generate 2 backup keys at the CDN and publish them in advance.
