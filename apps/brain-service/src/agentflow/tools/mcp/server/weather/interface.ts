export type OpenMeteoPlace = {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
};

export type OpenMeteoCurrent = {
  temperatureC: number | null;
  windKmh: number | null;
  weatherCode: number | null;
};
