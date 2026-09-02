import { Redirect } from 'expo-router';

// R1: opens straight into the throwaway showcase for the verification gate.
// R2 replaces this with the real Home screen.
export default function Index() {
  return <Redirect href="/showcase" />;
}
