import type { OpenMeteoCurrent, OpenMeteoPlace } from "./interface";

export type { OpenMeteoCurrent, OpenMeteoPlace } from "./interface";

/** WMO 天气代码 → 短中文（结构化码表，非用户口语） */
export const wmoWeatherLabelZh = (code: number | null): string => {
  if (code === null || !Number.isFinite(code)) return "天气不明";
  if (code === 0) return "晴";
  if (code === 1 || code === 2) return "少云";
  if (code === 3) return "多云";
  if (code === 45 || code === 48) return "雾";
  if (code >= 51 && code <= 57) return "毛毛雨";
  if (code >= 61 && code <= 67) return "雨";
  if (code >= 71 && code <= 77) return "雪";
  if (code >= 80 && code <= 82) return "阵雨";
  if (code >= 85 && code <= 86) return "阵雪";
  if (code >= 95 && code <= 99) return "雷暴";
  return `天气代码 ${code}`;
};

export const formatOpenMeteoAnswer = (input: {
  place: OpenMeteoPlace;
  current: OpenMeteoCurrent;
}): string => {
  const where = [input.place.name, input.place.country]
    .filter(Boolean)
    .join("，");
  const temp =
    input.current.temperatureC === null
      ? "气温未知"
      : `${Math.round(input.current.temperatureC)}°C`;
  const wind =
    input.current.windKmh === null
      ? ""
      : `，风速 ${Math.round(input.current.windKmh)} km/h`;
  const sky = wmoWeatherLabelZh(input.current.weatherCode);
  return `${where}：${temp}，${sky}${wind}。数据来源 Open-Meteo（CC BY 4.0）。`;
};

export const geocodeOpenMeteoPlace = async (
  location: string
): Promise<OpenMeteoPlace | null> => {
  const name = location.trim();
  if (!name) return null;
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "zh");
  const res = await fetch(url);
  if (!res.ok) return null;
  const body = (await res.json()) as {
    results?: Array<{
      name?: string;
      latitude?: number;
      longitude?: number;
      country?: string;
    }>;
  };
  const hit = body.results?.[0];
  if (
    !hit ||
    typeof hit.latitude !== "number" ||
    typeof hit.longitude !== "number"
  ) {
    return null;
  }
  return {
    name: hit.name?.trim() || name,
    latitude: hit.latitude,
    longitude: hit.longitude,
    country: hit.country,
  };
};

export const fetchOpenMeteoCurrent = async (
  place: OpenMeteoPlace
): Promise<OpenMeteoCurrent | null> => {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(place.latitude));
  url.searchParams.set("longitude", String(place.longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,weather_code,wind_speed_10m"
  );
  url.searchParams.set("timezone", "auto");
  const res = await fetch(url);
  if (!res.ok) return null;
  const body = (await res.json()) as {
    current?: {
      temperature_2m?: number;
      weather_code?: number;
      wind_speed_10m?: number;
    };
  };
  const cur = body.current;
  if (!cur) return null;
  return {
    temperatureC:
      typeof cur.temperature_2m === "number" ? cur.temperature_2m : null,
    windKmh: typeof cur.wind_speed_10m === "number" ? cur.wind_speed_10m : null,
    weatherCode: typeof cur.weather_code === "number" ? cur.weather_code : null,
  };
};

export const lookupOpenMeteoWeatherText = async (
  location: string
): Promise<{ ok: boolean; text: string }> => {
  const place = await geocodeOpenMeteoPlace(location);
  if (!place) {
    return { ok: false, text: `未找到地点：${location.trim() || "（空）"}` };
  }
  const current = await fetchOpenMeteoCurrent(place);
  if (!current) {
    return { ok: false, text: `无法获取「${place.name}」的天气` };
  }
  return { ok: true, text: formatOpenMeteoAnswer({ place, current }) };
};
