// 緯度経度の表示用。

export type Fix = { lat: number; lon: number; accuracy: number | null; time: number };

/** 度を「度分秒」に（例：35°21′38″） */
export function toDms(deg: number): string {
  const a = Math.abs(deg);
  const d = Math.floor(a);
  const mFloat = (a - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60 * 10) / 10;
  return `${d}°${m}′${s}″`;
}

export function formatFix(f: Fix): string {
  const ns = f.lat >= 0 ? '北緯' : '南緯';
  const ew = f.lon >= 0 ? '東経' : '西経';
  return `${ns}${Math.abs(f.lat).toFixed(5)} ${ew}${Math.abs(f.lon).toFixed(5)}`;
}
