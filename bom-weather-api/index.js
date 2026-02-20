const express = require('express');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// BOM observation station IDs
const STATIONS = {
  melbourne: {
    id: 'IDV60901/IDV60901.95936',
    name: 'Melbourne Olympic Park'
  },
  adelaide: {
    id: 'IDS60901/IDS60901.94675',
    name: 'Adelaide West Terrace'
  }
};

// Cache for 10 minutes (BOM updates ~every 30 min)
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function fetchBOM(url) {
  return new Promise((resolve, reject) => {
    http.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function getObservations(city) {
  const station = STATIONS[city.toLowerCase()];
  if (!station) throw new Error('Unknown city');
  
  const cacheKey = `obs_${city}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const url = `http://www.bom.gov.au/fwo/${station.id}.json`;
  const bomData = await fetchBOM(url);
  const obs = bomData.observations.data[0];
  
  const result = {
    station: station.name,
    city: city.charAt(0).toUpperCase() + city.slice(1),
    temp: obs.air_temp,
    apparentTemp: obs.apparent_t,
    condition: obs.weather || 'Clear',
    humidity: obs.rel_hum,
    windDir: obs.wind_dir || 'Calm',
    windSpeed: obs.wind_spd_kmh || 0,
    windGust: obs.gust_kmh || 0,
    pressure: obs.press,
    dewPoint: obs.dewpt,
    rain24h: obs.rain_trace || 0,
    timestamp: obs.local_date_time_full,
    updatedAt: new Date().toISOString()
  };
  
  cache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

app.get('/', (req, res) => {
  res.json({
    service: 'BOM Weather Proxy',
    endpoints: [
      '/weather/melbourne',
      '/weather/adelaide',
      '/weather/both'
    ]
  });
});

app.get('/weather/:city', async (req, res) => {
  try {
    const data = await getObservations(req.params.city);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/weather/both', async (req, res) => {
  try {
    const [melbourne, adelaide] = await Promise.all([
      getObservations('melbourne'),
      getObservations('adelaide')
    ]);
    res.json({ melbourne, adelaide });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`BOM Weather Proxy running on port ${PORT}`);
});
