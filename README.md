# Webcam Explorer

Webcam Explorer is a geospatial web application for locating and previewing public webcams.
It uses Leaflet for map rendering, Windy Webcams API for camera data, and OpenStreetMap Nominatim for place search.

## Features

- Interactive map with clustered webcam markers
- Dynamic webcam loading based on current map viewport
- Category filter (loaded from Windy API)
- Location search by city/place name
- Webcam details panel with:
	- preview image
	- location and category data
	- view count, update date, and status
	- embedded player (when available)
	- direct link to webcam details on Windy

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript (ES6+)
- [Leaflet](https://leafletjs.com/)
- [Windy Webcams API v3](https://api.windy.com/webcams)
- [Nominatim API](https://nominatim.openstreetmap.org/)

## Project Structure

- `index.html` — application layout and external library imports
- `style.css` — UI styling (sidebar, map, popups, panel)
- `app.js` — app logic, API calls, rendering, interactions

## Getting Started

1. Clone this repository.
2. Open the project folder.
3. Run a local static server and open `index.html` in the browser.

Example with VS Code Live Server:

- install Live Server extension
- right-click `index.html`
- choose **Open with Live Server**

## Configuration

The Windy API key is currently stored directly in `app.js`:

```js
const API_KEY = 'YOUR_API_KEY';
```
