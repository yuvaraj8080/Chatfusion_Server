import NodeGeocoder from "node-geocoder";

export const geocoder = NodeGeocoder({
  provider: (process.env.GEOCODER_PROVIDER as any) || "openstreetmap",
  apiKey: (process.env.GEOCODER_API_KEY as any) || "",
  formatter: null,
});

export const getLocationByCoordinates = async (coordinates: number[]) => {
  const res = await geocoder.reverse({
    lat: coordinates[0],
    lon: coordinates[1],
  });
  return res[0];
};
