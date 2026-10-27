import { Redirect } from 'expo-router';

/** `/` → Estimates tab; the root layout sends logged-out users on to /login. */
export default function Index() {
  return <Redirect href="/(tabs)/estimates" />;
}
