const R = 6371.0088; // km
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function circlePolygon(lat: number, lon: number, km: number, steps = 72) {
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    const dLat = (km / R) * Math.cos(a);
    const dLon = ((km / R) * Math.sin(a)) / Math.cos(rad(lat));
    coords.push([lon + (dLon * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
  }
  return { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [coords] } };
}

export function circleBbox(lat: number, lon: number, km: number): [number, number, number, number] {
  const dLat = ((km / R) * 180) / Math.PI;
  const dLon = dLat / Math.cos(rad(lat));
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}
