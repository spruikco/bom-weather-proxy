# BOM Weather Proxy

Proxy service for Bureau of Meteorology data to bypass scraping restrictions.

## Stations

- **Melbourne**: Olympic Park (IDV60901.95936)
- **Adelaide**: West Terrace (IDS60901.94675)

## Deployment

Deploy to Render:
1. Push this directory to a Git repo
2. Connect to Render (it will auto-detect render.yaml)
3. Deploy

Or use Render CLI:
```bash
render deploy
```

## Endpoints

- `GET /weather/melbourne` - Melbourne observations
- `GET /weather/adelaide` - Adelaide observations
- `GET /weather/both` - Both cities

## Cache

Responses cached for 10 minutes (BOM updates every ~30 min).
