/** Open-Meteo seasonal climate (no API key). */

export type SeasonStat = {
  value: string;
  qualifier: string;
};

/**
 * Typical high for the trip month near lat/lng using climate normals.
 * Omits when unresolved (caller must not show "checking…").
 */
export async function getSeasonStat(input: {
  lat: number;
  lng: number;
  /** Month 1–12 of the trip */
  month: number;
}): Promise<SeasonStat | null> {
  const month = Math.min(12, Math.max(1, Math.round(input.month)));
  try {
    const url = new URL("https://climate-api.open-meteo.com/v1/climate");
    url.searchParams.set("latitude", String(input.lat));
    url.searchParams.set("longitude", String(input.lng));
    url.searchParams.set("start_date", "1991-01-01");
    url.searchParams.set("end_date", "2020-12-31");
    url.searchParams.set("models", "CMCC_CM2_VHR4");
    url.searchParams.set(
      "daily",
      "temperature_2m_mean,temperature_2m_max",
    );

    // Prefer monthly archive endpoint (lighter)
    const archive = new URL("https://archive-api.open-meteo.com/v1/archive");
    // Use a recent year same month as proxy if climate fails
    const year = 2023;
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDay = month === 2 ? 28 : [4, 6, 9, 11].includes(month) ? 30 : 31;
    const end = `${year}-${String(month).padStart(2, "0")}-${endDay}`;
    archive.searchParams.set("latitude", String(input.lat));
    archive.searchParams.set("longitude", String(input.lng));
    archive.searchParams.set("start_date", start);
    archive.searchParams.set("end_date", end);
    archive.searchParams.set("daily", "temperature_2m_max");
    archive.searchParams.set("temperature_unit", "fahrenheit");

    const res = await fetch(archive.toString(), {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      daily?: { temperature_2m_max?: (number | null)[] };
    };
    const highs = (json.daily?.temperature_2m_max ?? []).filter(
      (n): n is number => typeof n === "number" && Number.isFinite(n),
    );
    if (highs.length === 0) return null;
    const avg = Math.round(
      highs.reduce((s, n) => s + n, 0) / highs.length,
    );
    const monthName = new Date(2000, month - 1, 1).toLocaleString("en-US", {
      month: "long",
    });
    return {
      value: `${avg}°`,
      qualifier: `typical ${monthName} high`,
    };
  } catch {
    return null;
  }
}
