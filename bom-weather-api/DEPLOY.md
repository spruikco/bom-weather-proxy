# Deployment Instructions

## Option 1: Deploy via Render Dashboard

1. Go to https://dashboard.render.com/
2. Click "New +" → "Web Service"
3. Connect this repository (you'll need to push to GitHub first)
4. Render will auto-detect `render.yaml` and configure everything
5. Click "Create Web Service"
6. Note the service URL (e.g., `https://bom-weather-proxy.onrender.com`)

## Option 2: Push to GitHub, then connect to Render

```bash
# Create a new GitHub repo (via web UI or gh CLI)
# Then:
cd /home/node/.openclaw/workspace
git remote add origin https://github.com/YOUR_USERNAME/bom-weather-proxy.git
git push -u origin master

# Now connect it to Render via dashboard (see Option 1)
```

## After Deployment

Once deployed, update the environment variable in your OpenClaw config:

```bash
export BOM_WEATHER_URL="https://your-service.onrender.com"
```

Or add to your `.env`:
```
BOM_WEATHER_URL=https://your-service.onrender.com
```

The weather service script will automatically use the BOM proxy when this URL is set.

## Testing

Once deployed, test with:
```bash
curl https://your-service.onrender.com/weather/melbourne
curl https://your-service.onrender.com/weather/adelaide
curl https://your-service.onrender.com/weather/both
```
