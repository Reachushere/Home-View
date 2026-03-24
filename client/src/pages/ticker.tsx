import { useState, useEffect, useRef, useMemo } from "react";

import newsTickerLabel from "@assets/News_1773894837015.png";
import ctvLogoPath from "@assets/CTV2_1773545440801.png";
import cnnLogoPath from "@assets/CNN_1773536484180.png";
import globalLogoPath from "@assets/Global_White_1773536754594.png";
import cbcLogoPath from "@assets/cbc-news-logo-black-and-white_1773536865600.png";
import msnbcLogoPath from "@assets/MSNBC_1773536950584.png";
import politicoLogoPath from "@assets/Politico_1773537080711.png";
import rawStoryLogoPath from "@assets/Raw_Story_1773607642361.png";
import abcNewsLogoPath from "@assets/ABC_1773609250051.png";
import weatherAlertLogoPath from "@assets/Weather_Alert_1773608511887.png";
import bbcNewsLogoPath from "@assets/BBC_1773609711103.png";
import forecastIconPath from "@assets/Forecast2_1773897989398.png";
import cnTowerPath from "@assets/CN2_1773897525570.png";
import newspaperIconPath from "@assets/Newspaper2_1773898792176.png";
import foxNewsLogoPath from "@assets/Fox_News_1773610204651.png";

const TICKER_LOGO_MAP: Record<string, { src: string; height: number }> = {
  CNN: { src: cnnLogoPath, height: 33 },
  CBC: { src: cbcLogoPath, height: 78 },
  CTV: { src: ctvLogoPath, height: 42 },
  Global: { src: globalLogoPath, height: 42 },
  MSNBC: { src: msnbcLogoPath, height: 68 },
  Politico: { src: politicoLogoPath, height: 57 },
  'Raw Story': { src: rawStoryLogoPath, height: 64 },
  'ABC News': { src: abcNewsLogoPath, height: 56 },
  'BBC': { src: bbcNewsLogoPath, height: 64 },
  'Fox News': { src: foxNewsLogoPath, height: 72 },
};

const WMO_DESC: Record<number, string> = { 0:'Clear',1:'Mainly Clear',2:'Partly Cloudy',3:'Overcast',45:'Fog',48:'Rime Fog',51:'Light Drizzle',53:'Drizzle',55:'Heavy Drizzle',61:'Light Rain',63:'Rain',65:'Heavy Rain',66:'Freezing Rain',67:'Heavy Freezing Rain',71:'Light Snow',73:'Snow',75:'Heavy Snow',77:'Snow Grains',80:'Light Showers',81:'Showers',82:'Heavy Showers',85:'Light Snow Showers',86:'Heavy Snow Showers',95:'Thunderstorm',96:'Thunderstorm w/ Hail',99:'Severe Thunderstorm' };

const wmoShort = (c: number) => ({ 0:'clear',1:'mostly clear',2:'partly cloudy',3:'overcast',45:'foggy',48:'foggy',51:'light drizzle',53:'drizzle',55:'heavy drizzle',61:'light rain',63:'rain',65:'heavy rain',66:'freezing rain',67:'heavy freezing rain',71:'light snow',73:'snow',75:'heavy snow',77:'snow grains',80:'light showers',81:'showers',82:'heavy showers',85:'light snow showers',86:'heavy snow showers',95:'thunderstorms',96:'thunderstorms with hail',99:'severe thunderstorms' }[c] || 'mixed conditions');

type Headline = { title: string; source: string; link: string; publishedAt?: string };
type WeatherData = { code: number; temp: number; windSpeed: number; isDay: boolean; daily?: { date: string; high: number; low: number; weatherCode?: number }[] };
type PollenData = { tree: { value: number; level: string }; grass: { value: number; level: string }; weed: { value: number; level: string }; overall: { value: number; level: string }; aqi: number };

function buildTickerItems(newsHeadlines: Headline[], weatherData: WeatherData | null, pollenData: PollenData | null, weatherAlerts: { title: string }[]): Headline[] {
  const items: Headline[] = [];

  for (const a of weatherAlerts) {
    items.push({ title: `⚠️ ${a.title}`, source: '_ALERT_', link: '' });
  }

  if (weatherData) {
    const desc = WMO_DESC[weatherData.code] || 'Mixed';
    items.push({ title: `<img src="${cnTowerPath}" style="height:34px;width:auto;display:inline-block;vertical-align:middle;margin-right:9px" />Toronto Forecast: ${Math.round(weatherData.temp)}°C — ${desc}  |  Wind: ${Math.round(weatherData.windSpeed)} km/h`, source: '_FORECAST_NOSEP_', link: '' });
    if (weatherData.daily && weatherData.daily.length >= 3) {
      const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const forecastParts = weatherData.daily.slice(0, 3).map(d => {
        const dt = new Date(d.date + 'T12:00:00');
        const dayName = dayNames[dt.getDay()];
        return `${dayName}: ${Math.round(d.high)}°/${Math.round(d.low)}°`;
      });
      items.push({ title: `<img src="${forecastIconPath}" style="height:20px;width:auto;display:inline-block;vertical-align:middle;margin-left:3px;margin-right:9px;position:relative;top:-2px" />3-Day Forecast: ${forecastParts.join('  •  ')}`, source: '_FORECAST_', link: '' });
      const briefParts: string[] = [];
      const todayD = weatherData.daily[0];
      const tomorrowD = weatherData.daily[1];
      const day3D = weatherData.daily[2];
      const todayDesc = wmoShort(todayD.weatherCode || weatherData.code);
      briefParts.push(`Currently ${Math.round(weatherData.temp)}° and ${todayDesc}. Today's high ${Math.round(todayD.high)}°, low ${Math.round(todayD.low)}°.`);
      if (tomorrowD) {
        const tmrDesc = wmoShort(tomorrowD.weatherCode || 0);
        const tmrName = dayNames[new Date(tomorrowD.date + 'T12:00:00').getDay()];
        briefParts.push(`${tmrName}: ${tmrDesc}, ${Math.round(tomorrowD.high)}°/${Math.round(tomorrowD.low)}°.`);
      }
      if (day3D) {
        const d3Desc = wmoShort(day3D.weatherCode || 0);
        const d3Name = dayNames[new Date(day3D.date + 'T12:00:00').getDay()];
        briefParts.push(`${d3Name}: ${d3Desc}, ${Math.round(day3D.high)}°/${Math.round(day3D.low)}°.`);
      }
      items.push({ title: `<img src="${newspaperIconPath}" style="height:22px;width:auto;display:inline-block;vertical-align:middle;margin-right:9px;position:relative;top:-2px" />Forecast Brief: ${briefParts.join('  ')}`, source: '_FORECAST_NOSEP_', link: '' });
    }
  }

  if (pollenData) {
    items.push({ title: `<span style="margin-left:17px;font-size:17px;margin-right:4px;vertical-align:middle">🌿</span>Pollen: ${pollenData.overall.level} (Tree: ${pollenData.tree.level}, Grass: ${pollenData.grass.level}, Weed: ${pollenData.weed.level})  |  AQI: ${pollenData.aqi} (${pollenData.aqi <= 50 ? 'Good' : pollenData.aqi <= 100 ? 'Moderate' : pollenData.aqi <= 150 ? 'Unhealthy for Sensitive' : pollenData.aqi <= 200 ? 'Unhealthy' : pollenData.aqi <= 300 ? 'Very Unhealthy' : 'Hazardous'})`, source: '_FORECAST_NOSEP_', link: '' });
  }

  const US_SOURCES = ['CNN', 'Politico', 'Raw Story', 'MSNBC', 'ABC News', 'Fox News'];
  const ca = newsHeadlines.filter(h => !US_SOURCES.includes(h.source) && h.source !== 'BBC');
  const us = newsHeadlines.filter(h => US_SOURCES.includes(h.source));
  const bbc = newsHeadlines.filter(h => h.source === 'BBC');
  const max = Math.max(ca.length, us.length, bbc.length);
  for (let i = 0; i < max; i++) {
    if (i < ca.length) items.push(ca[i]);
    if (i < us.length) items.push(us[i]);
    if (i < bbc.length) items.push(bbc[i]);
  }

  return items;
}

function renderTickerHtml(headlines: Headline[]): string {
  return headlines.map((item, i) => {
    if (item.source === '_ALERT_') {
      const safeTitle = item.title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      return `<span class="inline-flex items-center gap-1.5 mx-4" style="animation:tickerAlertBlink 1s ease-in-out infinite" data-testid="weather-alert-${i}"><img src="${weatherAlertLogoPath}" alt="Weather Alert" class="rounded-sm" style="height:28px;width:auto;object-fit:contain" /><span class="text-[13px] font-bold" style="color:#ff4444;text-shadow:0 0 6px rgba(255,68,68,0.5)">${safeTitle}</span><span class="text-white/20 mx-2">|</span></span>`;
    }
    if (item.source === '_FORECAST_' || item.source === '_FORECAST_NOSEP_') {
      const forecastHtml = item.title.replace(/(<b>[^<]*<\/b>:?|(?:Toronto Forecast|3-Day Forecast:|Forecast Brief:|Pollen):?)/, '<span style="color:rgb(0,255,0);text-shadow:0 0 4px rgba(0,255,0,0.3)">$1</span>');
      const sep = item.source === '_FORECAST_' ? '<span class="text-white/20 mx-2">|</span>' : '';
      return `<span class="inline-flex items-center gap-1.5 mx-4" data-testid="weather-forecast-${i}"><span class="text-[13px] text-white/95">${forecastHtml}</span>${sep}</span>`;
    }
    const logoInfo = TICKER_LOGO_MAP[item.source];
    const logoHtml = logoInfo
      ? `<img src="${logoInfo.src}" alt="${item.source}" class="rounded-sm" style="height:${logoInfo.height}px;width:auto;min-width:${logoInfo.height}px;object-fit:contain;vertical-align:middle" />`
      : `<span class="text-[11px] font-bold px-1 py-0 rounded bg-gray-600 text-white">${item.source}</span>`;
    const safeTitle = item.title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    let timeAgoHtml = '';
    if (item.publishedAt) {
      const diff = Date.now() - new Date(item.publishedAt).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins >= 0 && mins <= 4320) {
        const ago = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`;
        timeAgoHtml = `<span class="text-[11px]" style="color:rgba(255,255,255,0.6);margin-left:4px">${ago}</span>`;
      }
    }
    return `<a href="${item.link}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 mx-4 no-underline hover:underline" data-testid="news-headline-${i}">${logoHtml}<span class="text-white/85 mx-1 text-[13px]" style="line-height:1;vertical-align:middle;font-weight:300">|</span><span class="text-[13px] text-white/90">${safeTitle}</span>${timeAgoHtml}</a>`;
  }).join('');
}

export default function TickerPage() {
  const [newsHeadlines, setNewsHeadlines] = useState<Headline[]>([]);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [pollenData, setPollenData] = useState<PollenData | null>(null);
  const [weatherAlerts, setWeatherAlerts] = useState<{ title: string; summary: string; type: string }[]>([]);
  const tickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch('/api/news');
        if (res.ok) setNewsHeadlines(await res.json());
      } catch (e) { console.error('[Ticker] news fetch failed:', e); }
    };
    fetchNews();
    const interval = setInterval(fetchNews, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch('/api/weather');
        if (res.ok) setWeatherData(await res.json());
      } catch (e) { console.error('[Ticker] weather fetch failed:', e); }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchPollen = async () => {
      try {
        const res = await fetch('/api/pollen');
        if (res.ok) setPollenData(await res.json());
      } catch (e) { console.error('[Ticker] pollen fetch failed:', e); }
    };
    fetchPollen();
    const interval = setInterval(fetchPollen, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/weather-alerts');
        if (res.ok) setWeatherAlerts(await res.json());
      } catch (e) { console.error('[Ticker] alerts fetch failed:', e); }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const allHeadlines = useMemo(() =>
    buildTickerItems(newsHeadlines, weatherData, pollenData, weatherAlerts),
    [newsHeadlines, weatherData, pollenData, weatherAlerts]
  );

  useEffect(() => {
    if (!tickerRef.current || allHeadlines.length === 0) return;
    const html = renderTickerHtml(allHeadlines);
    const scrollContainer = tickerRef.current.querySelector('.news-ticker-scroll') as HTMLElement;
    if (scrollContainer) {
      scrollContainer.innerHTML = html;
      const applyAnim = () => {
        const contentWidth = scrollContainer.scrollWidth;
        const parentWidth = scrollContainer.parentElement?.clientWidth || window.innerWidth;
        const totalTravel = parentWidth + contentWidth;
        const speed = 65;
        const duration = totalTravel / speed;
        scrollContainer.style.setProperty('--ticker-start', `${parentWidth}px`);
        scrollContainer.style.setProperty('--ticker-end', `-${contentWidth}px`);
        scrollContainer.style.animation = `tickerScroll ${duration}s linear infinite`;
      };
      const imgs = scrollContainer.querySelectorAll('img');
      if (imgs.length > 0) {
        let loaded = 0;
        const onLoad = () => { loaded++; if (loaded >= imgs.length) requestAnimationFrame(applyAnim); };
        imgs.forEach(img => { if (img.complete) { loaded++; } else { img.addEventListener('load', onLoad); img.addEventListener('error', onLoad); } });
        if (loaded >= imgs.length) requestAnimationFrame(applyAnim);
        setTimeout(applyAnim, 500);
      } else {
        requestAnimationFrame(applyAnim);
      }
    }
  }, [allHeadlines]);

  return (
    <div
      style={{ width: '100vw', height: '38px', overflow: 'hidden', background: 'transparent', margin: 0, padding: 0 }}
      data-testid="ticker-page"
    >
      <div
        ref={tickerRef}
        className="flex overflow-hidden"
        style={{
          height: '38px',
          background: 'linear-gradient(90deg,#000000 0%,#14141e 50%,#000000 100%)',
          borderTop: '1px solid rgba(255,255,255,0.15)',
        }}
        data-testid="news-ticker"
      >
        <div className="flex-shrink-0 flex items-center justify-center" style={{ height: '38px', width: 'auto' }}>
          <img src={newsTickerLabel} alt="NEWS" style={{ height: '38px', width: 'auto', objectFit: 'contain' }} />
        </div>
        <div className="flex-1 overflow-hidden relative h-full">
          <div className="flex items-center h-full whitespace-nowrap news-ticker-scroll" style={{ position: 'relative', paddingTop: '4px' }} />
        </div>
      </div>
    </div>
  );
}