# CLARA Estimator (estimator-native)

Expo / React Native client for the CLARA Estimator with two tabs — **Estimates** and **Profile** —
plus the hidden public pages `/company-registration` and `/op-x7k2`. One codebase runs on iOS,
Android and the web; TVs and projectors are served through the browser (native tvOS / Android TV
would need the `react-native-tvos` fork and are out of scope).

Backends (unchanged): the auth/users API (`technician-copilot-server`) and `copilot-server`.

## Run

```bash
npm install
cp .env.example .env         # edit the two URLs
npx expo start --web         # browser (port 8081)
npx expo start --android     # emulator: use http://10.0.2.2:… in .env
npx expo start --ios
```

Dev servers must allow the web origin: set `ALLOW_ORIGIN=http://localhost:8081` on both backends.
copilot-server can also run with `ALLOW_DEV_AUTH_BYPASS=true` and the `EXPO_PUBLIC_COPILOT_DEV_*`
variables from `.env.example` to skip login.

Checks: `npx tsc --noEmit`, `npx expo lint`, `npx jest`, `npx expo export -p web`.

## Builds

EAS (`eas.json`): `eas build --profile preview --platform all`. `scripts/sync-env-to-eas.js`
pushes `EXPO_PUBLIC_*` from `.env.preview` / `.env.production` into EAS secrets. Bundle id and
package: `com.justclara.estimator`; scheme `estimator` (deep links such as
`estimator://company-registration`).

## Layout

- `src/app` — expo-router routes: `(tabs)/estimates`, `(tabs)/profile`, `estimates/[id]`, `login`,
  `company-registration`, `op-x7k2`. Root `_layout.tsx` guards everything except the public routes.
- `src/components/estimates` — chat + estimate editor; `profile` — profile cards and connections;
  `admin` — the ops console tabs.
- `src/services` — API clients ported from the web client (`quotesService`, `connectionsService`,
  `adminService`, …) with `authFetch` / `apiClient` doing the 401 → refresh → retry chain.
- `src/lib/useLayout.ts` — breakpoints: compact <600, medium <1024, expanded <1600, large ≥1600.
  Wide layouts get a top navbar, list + detail panes, and chat beside the estimate.

## Staying logged in on iOS / Android

Tokens persist in AsyncStorage; an expired access token is refreshed silently; when the refresh
token itself dies the app re-logs in with the credentials saved at the last interactive login
(`expo-secure-store`: iOS Keychain / Android Keystore). Only an explicit Log Out, or a changed
password, shows the login screen again. The web build keeps tokens only. If storing the password
on the device is ever unwanted, the alternative is a long-lived device refresh token on the auth
server.

## Deliberate simplifications

Search for `ponytail:` in the source. Notably: QuickBooks OAuth completes in the browser and the
app refreshes connection status on return to the foreground.

PDF preview (`src/components/PdfViewer.tsx`): iOS renders the file in WKWebView, Android paints it
with pdf.js (CDN, needs internet) inside the WebView, web uses an `<iframe>`.
