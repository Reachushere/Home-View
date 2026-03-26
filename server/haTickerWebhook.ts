import { IStorage } from "./storage";

const HOME_ASSISTANT_URL = "https://ec8ebfanqrqlsnmnggrdl4yzq2i8koah.ui.nabu.casa";
const tokenFromEnv = process.env.HOME_ASSISTANT_TOKEN || "";
const urlFromEnv = process.env.HOME_ASSISTANT_URL || "";
const HOME_ASSISTANT_TOKEN = tokenFromEnv.startsWith("eyJ") ? tokenFromEnv : (urlFromEnv.startsWith("eyJ") ? urlFromEnv : tokenFromEnv);

const WMO: Record<number, string> = {0:'Clear',1:'Mainly Clear',2:'Partly Cloudy',3:'Overcast',45:'Fog',48:'Rime Fog',51:'Light Drizzle',53:'Drizzle',55:'Heavy Drizzle',61:'Light Rain',63:'Rain',65:'Heavy Rain',66:'Freezing Rain',67:'Heavy Freezing Rain',71:'Light Snow',73:'Snow',75:'Heavy Snow',77:'Snow Grains',80:'Light Showers',81:'Showers',82:'Heavy Showers',85:'Light Snow Showers',86:'Heavy Snow Showers',95:'Thunderstorm',96:'Thunderstorm w/ Hail',99:'Severe Thunderstorm'};
const WMO_BRIEF: Record<number, string> = {0:'clear',1:'mostly clear',2:'partly cloudy',3:'overcast',45:'foggy',48:'foggy',51:'light drizzle',53:'drizzle',55:'heavy drizzle',61:'light rain',63:'rain',65:'heavy rain',66:'freezing rain',67:'heavy freezing rain',71:'light snow',73:'snow',75:'heavy snow',77:'snow grains',80:'light showers',81:'showers',82:'heavy showers',85:'light snow showers',86:'heavy snow showers',95:'thunderstorms',96:'thunderstorms with hail',99:'severe thunderstorms'};
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

async function fetchWithTimeout(url: string, ms: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return r.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function pushSensorToHA(entityId: string, state: string, attributes: Record<string, any>): Promise<boolean> {
  const haUrl = HOME_ASSISTANT_URL.replace(/\/$/, '');
  try {
    const resp = await fetch(`${haUrl}/api/states/${entityId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HOME_ASSISTANT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state, attributes }),
    });
    return resp.ok;
  } catch (err: any) {
    console.error(`[HA Ticker] Failed to push ${entityId}:`, err.message);
    return false;
  }
}

export async function pushTickerToHA(storage: IStorage, port: number | string): Promise<void> {
  if (!HOME_ASSISTANT_TOKEN) {
    console.log('[HA Ticker] No HOME_ASSISTANT_TOKEN, skipping push');
    return;
  }

  try {
    const baseUrl = `http://localhost:${port}`;
    const [alertRes, wxRes, pollenRes, newsRes] = await Promise.all([
      fetchWithTimeout(`${baseUrl}/api/weather-alerts`, 3000),
      fetchWithTimeout(`${baseUrl}/api/weather`, 3000),
      fetchWithTimeout(`${baseUrl}/api/pollen`, 3000),
      fetchWithTimeout(`${baseUrl}/api/news`, 4000),
    ]);

    const segments: string[] = [];
    const alertItems: string[] = [];
    const newsItems: Array<{ title: string; source: string; link: string; ago: string }> = [];

    if (alertRes?.alerts?.length) {
      for (const a of alertRes.alerts) {
        alertItems.push(a.title);
        segments.push(`⚠️ ${a.title}`);
      }
    }

    let weatherState = '';
    let forecastBrief = '';
    let forecastDays: string[] = [];
    if (wxRes?.current) {
      const c = wxRes.current;
      const temp = Math.round(c.temperature_2m);
      const desc = WMO[c.weather_code as number] || 'Mixed';
      const wind = Math.round(c.wind_speed_10m);
      weatherState = `${temp}°C — ${desc} | Wind: ${wind} km/h`;
      segments.push(`🌡️ Toronto: ${weatherState}`);

      if (wxRes.daily?.time?.length >= 3) {
        forecastDays = wxRes.daily.time.slice(0, 3).map((t: string, i: number) => {
          const dt = new Date(t + 'T12:00:00');
          return `${DAYS[dt.getDay()]}: ${Math.round(wxRes.daily.temperature_2m_max[i])}°/${Math.round(wxRes.daily.temperature_2m_min[i])}°`;
        });
        segments.push(`📅 3-Day: ${forecastDays.join(' • ')}`);

        const briefParts: string[] = [];
        briefParts.push(`Currently ${temp}° and ${WMO_BRIEF[c.weather_code as number] || 'mixed conditions'}. Today's high ${Math.round(wxRes.daily.temperature_2m_max[0])}°, low ${Math.round(wxRes.daily.temperature_2m_min[0])}°.`);
        for (let bi = 1; bi <= 2; bi++) {
          if (wxRes.daily.time[bi]) {
            const bdt = new Date(wxRes.daily.time[bi] + 'T12:00:00');
            const bDesc = WMO_BRIEF[wxRes.daily.weather_code?.[bi] as number] || 'mixed conditions';
            briefParts.push(`${DAYS[bdt.getDay()]}: ${bDesc}, ${Math.round(wxRes.daily.temperature_2m_max[bi])}°/${Math.round(wxRes.daily.temperature_2m_min[bi])}°.`);
          }
        }
        forecastBrief = briefParts.join(' ');
      }
    }

    let pollenText = '';
    if (pollenRes?.overall) {
      pollenText = `${pollenRes.overall.level} (Tree: ${pollenRes.tree.level}, Grass: ${pollenRes.grass.level}, Weed: ${pollenRes.weed.level}) | AQI: ${pollenRes.aqi}`;
      segments.push(`🌿 Pollen: ${pollenText}`);
    }

    if (newsRes && Array.isArray(newsRes)) {
      const US_SOURCES = ['CNN','Politico','Raw Story','MSNBC','ABC News','Fox News'];
      const ca: any[] = [], us: any[] = [], bbc: any[] = [];
      newsRes.forEach((h: any) => {
        if (h.source === 'BBC') bbc.push(h);
        else if (US_SOURCES.includes(h.source)) us.push(h);
        else ca.push(h);
      });
      const max = Math.max(ca.length, us.length, bbc.length);
      const interleaved: any[] = [];
      for (let i = 0; i < max; i++) {
        if (i < ca.length) interleaved.push(ca[i]);
        if (i < us.length) interleaved.push(us[i]);
        if (i < bbc.length) interleaved.push(bbc[i]);
      }
      for (const item of interleaved) {
        let ago = '';
        if (item.publishedAt) {
          const diff = Date.now() - new Date(item.publishedAt).getTime();
          const mins = Math.floor(diff / 60000);
          if (mins >= 0 && mins <= 4320) {
            ago = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`;
          }
        }
        newsItems.push({ title: item.title, source: item.source, link: item.link || '', ago });
        segments.push(`📰 ${item.source}: ${item.title}`);
      }
    }

    const fullTickerText = segments.join('  |||  ');

    await pushSensorToHA('sensor.dashboard_ticker', fullTickerText.slice(0, 255), {
      friendly_name: 'Dashboard News Ticker',
      icon: 'mdi:newspaper-variant-outline',
      full_text: fullTickerText,
      segment_count: segments.length,
      segments,
      weather: weatherState,
      forecast_3day: forecastDays.join(' • '),
      forecast_brief: forecastBrief,
      pollen: pollenText,
      alerts: alertItems,
      news: newsItems.slice(0, 30).map(n => `${n.source}: ${n.title}${n.ago ? ` (${n.ago})` : ''}`),
      news_detailed: newsItems.slice(0, 30),
      last_updated: new Date().toISOString(),
    });

    if (weatherState) {
      await pushSensorToHA('sensor.dashboard_weather', weatherState, {
        friendly_name: 'Dashboard Weather',
        icon: 'mdi:weather-partly-cloudy',
        forecast_3day: forecastDays.join(' • '),
        forecast_brief: forecastBrief,
        pollen: pollenText,
        alerts: alertItems,
        last_updated: new Date().toISOString(),
      });
    }

    if (newsItems.length > 0) {
      await pushSensorToHA('sensor.dashboard_news', `${newsItems.length} headlines`, {
        friendly_name: 'Dashboard News',
        icon: 'mdi:newspaper',
        headlines: newsItems.slice(0, 30).map(n => `${n.source}: ${n.title}${n.ago ? ` (${n.ago})` : ''}`),
        headlines_detailed: newsItems.slice(0, 30),
        last_updated: new Date().toISOString(),
      });
    }

    console.log(`[HA Ticker] Pushed ${segments.length} segments to HA (weather: ${weatherState ? 'yes' : 'no'}, news: ${newsItems.length}, alerts: ${alertItems.length})`);
  } catch (err: any) {
    console.error('[HA Ticker] Push error:', err.message);
  }
}

let tickerInterval: NodeJS.Timeout | null = null;

export function startHATickerSync(storage: IStorage, port: number | string, intervalMs: number = 5 * 60 * 1000): void {
  if (tickerInterval) clearInterval(tickerInterval);

  setTimeout(() => {
    pushTickerToHA(storage, port);
  }, 30000);

  tickerInterval = setInterval(() => {
    pushTickerToHA(storage, port);
  }, intervalMs);

  console.log(`[HA Ticker] Sync started, pushing every ${Math.round(intervalMs / 60000)} minutes`);
}

export function stopHATickerSync(): void {
  if (tickerInterval) {
    clearInterval(tickerInterval);
    tickerInterval = null;
    console.log('[HA Ticker] Sync stopped');
  }
}
