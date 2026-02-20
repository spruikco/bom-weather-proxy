#!/usr/bin/env node

/**
 * Weather Service for Australian cities
 * Prefers BOM proxy (accurate Australian data) with Open-Meteo fallback
 */

const https = require('https');
const http = require('http');

const BOM_PROXY_URL = process.env.BOM_WEATHER_URL;

// City coordinates for Open-Meteo fallback
const CITIES = {
  melbourne: { lat: -37.8136, lon: 144.9631, name: 'Melbourne' },
  adelaide: { lat: -34.9285, lon: 138.6007, name: 'Adelaide' }
};

// WMO Weather codes for Open-Meteo
const WEATHER_CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
};

const WEATHER_EMOJI = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️', 77: '🌨️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️'
};

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

function getWindDirection(degrees) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return dirs[index];
}

function mapBOMCondition(condition) {
  const lower = (condition || '').toLowerCase();
  if (lower.includes('clear') || lower.includes('sunny')) return { emoji: '☀️', text: condition };
  if (lower.includes('cloud')) return { emoji: '☁️', text: condition };
  if (lower.includes('rain') || lower.includes('shower')) return { emoji: '🌧️', text: condition };
  if (lower.includes('storm')) return { emoji: '⛈️', text: condition };
  if (lower.includes('fog')) return { emoji: '🌫️', text: condition };
  if (lower.includes('snow')) return { emoji: '🌨️', text: condition };
  return { emoji: '🌡️', text: condition || 'Clear' };
}

async function getWeatherFromBOM(cityKey) {
  if (!BOM_PROXY_URL) throw new Error('BOM proxy not configured');
  
  const url = `${BOM_PROXY_URL.replace(/\/$/, '')}/weather/${cityKey.toLowerCase()}`;
  const data = await fetchJSON(url);
  
  const condition = mapBOMCondition(data.condition);
  
  return {
    city: data.city,
    source: 'BOM',
    current: {
      emoji: condition.emoji,
      condition: condition.text,
      temp: Math.round(data.temp),
      apparentTemp: Math.round(data.apparentTemp),
      humidity: data.humidity,
      windSpeed: Math.round(data.windSpeed),
      windDir: data.windDir,
      pressure: data.pressure,
      time: data.timestamp
    },
    success: true
  };
}

async function getWeatherFromOpenMeteo(cityKey) {
  const city = CITIES[cityKey.toLowerCase()];
  if (!city) throw new Error(`Unknown city: ${cityKey}`);

  const url = `https://api.open-meteo.com/v1/forecast?` +
    `latitude=${city.lat}&longitude=${city.lon}&` +
    `current_weather=true&` +
    `daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum&` +
    `timezone=auto`;

  const data = await fetchJSON(url);
  const current = data.current_weather;
  const daily = data.daily;
  
  const weatherCode = current.weathercode;
  const condition = WEATHER_CODES[weatherCode] || 'Unknown';
  const emoji = WEATHER_EMOJI[weatherCode] || '🌡️';
  const windDir = getWindDirection(current.winddirection);
  
  return {
    city: city.name,
    source: 'Open-Meteo',
    current: {
      emoji: emoji,
      condition: condition,
      temp: Math.round(current.temperature),
      windSpeed: Math.round(current.windspeed),
      windDir: windDir,
      time: current.time
    },
    today: {
      max: Math.round(daily.temperature_2m_max[0]),
      min: Math.round(daily.temperature_2m_min[0]),
      precipitation: daily.precipitation_sum[0]
    },
    success: true
  };
}

async function getWeatherForCity(cityKey) {
  try {
    // Try BOM proxy first
    if (BOM_PROXY_URL) {
      try {
        return await getWeatherFromBOM(cityKey);
      } catch (bomError) {
        console.error(`BOM proxy failed (${bomError.message}), falling back to Open-Meteo...`);
      }
    }
    
    // Fallback to Open-Meteo
    return await getWeatherFromOpenMeteo(cityKey);
    
  } catch (error) {
    return {
      city: cityKey.charAt(0).toUpperCase() + cityKey.slice(1),
      error: error.message,
      success: false
    };
  }
}

async function main() {
  const cityKeys = ['melbourne', 'adelaide'];
  
  console.log('Fetching weather data...\n');
  
  const reports = await Promise.all(cityKeys.map(key => getWeatherForCity(key)));
  
  for (const report of reports) {
    if (report.success) {
      const { current, today } = report;
      console.log(`**${report.city}**`);
      console.log(`${current.emoji} ${current.condition}, ${current.temp}°C` +
        (current.apparentTemp ? ` (feels like ${current.apparentTemp}°C)` : ''));
      
      if (today) {
        console.log(`Today: ${today.min}°C–${today.max}°C` +
          (today.precipitation > 0 ? ` • ${today.precipitation}mm rain` : ''));
      }
      
      if (current.humidity) {
        console.log(`Humidity ${current.humidity}% • Wind ${current.windDir} ${current.windSpeed} km/h`);
      } else {
        console.log(`Wind: ${current.windDir} ${current.windSpeed} km/h`);
      }
      
      console.log(`_Source: ${report.source}_\n`);
    } else {
      console.log(`**${report.city}**: ⚠️ ${report.error}\n`);
    }
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

module.exports = { getWeatherForCity };
