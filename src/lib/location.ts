import * as Location from 'expo-location';

// Coordinates are rounded to 2 decimals (~1 km) on the device before they ever leave it.
export async function requestApproxLocation(): Promise<{ lat: number; lng: number } | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') return null;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
  const r = (n: number) => Math.round(n * 100) / 100;
  return { lat: r(pos.coords.latitude), lng: r(pos.coords.longitude) };
}
