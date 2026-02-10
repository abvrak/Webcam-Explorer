// ===== Configuration =====
const API_KEY = 'p4itaEUZ9H6xmd2l4ld4mrBTpHdD9wy0';
const API_BASE = 'https://api.windy.com/webcams/api/v3';

// ===== Map Setup =====
const map = L.map('map', {
    center: [51.1, 17.0], // Wrocław
    zoom: 6,
    minZoom: 3,
    maxZoom: 18,
    zoomControl: true
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Webcams by <a href="https://www.windy.com">Windy.com</a>',
    maxZoom: 19
}).addTo(map);

// Marker cluster group
const markerCluster = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    disableClusteringAtZoom: 15
});
map.addLayer(markerCluster);

// ===== State =====
let webcams = [];
let activeMarker = null;
let categories = [];
let fetchTimeout = null;

// ===== DOM Elements =====
const loadingEl = document.getElementById('loading');
const webcamCountEl = document.getElementById('webcamCount');
const webcamInfoEl = document.getElementById('webcamInfo');
const closeInfoBtn = document.getElementById('closeInfo');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const categorySelect = document.getElementById('categorySelect');

// ===== API Helpers =====
async function apiRequest(endpoint, params = {}) {
    const url = new URL(`${API_BASE}${endpoint}`);
    Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
            url.searchParams.append(key, val);
        }
    });

    const response = await fetch(url.toString(), {
        headers: { 'x-windy-api-key': API_KEY }
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

// ===== Load Categories =====
async function loadCategories() {
    try {
        categories = await apiRequest('/categories', { lang: 'pl' });
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            categorySelect.appendChild(option);
        });
    } catch (err) {
        console.warn('Nie udało się załadować kategorii:', err);
    }
}

// ===== Load Webcams =====
async function loadWebcams() {
    const bounds = map.getBounds();
    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const west = bounds.getWest();

    showLoading(true);

    try {
        const params = {
            include: 'categories,images,location,player,urls',
            lang: 'pl',
            limit: 50,
            bbox: `${north},${east},${south},${west}`
        };

        const selectedCategory = categorySelect.value;
        if (selectedCategory) {
            params.categories = selectedCategory;
        }

        const data = await apiRequest('/webcams', params);
        webcams = data.webcams || [];
        webcamCountEl.textContent = data.total || webcams.length;

        renderMarkers();
    } catch (err) {
        console.error('Błąd ładowania kamer:', err);
        webcamCountEl.textContent = '0';
    } finally {
        showLoading(false);
    }
}

// ===== Render Markers =====
function renderMarkers() {
    markerCluster.clearLayers();

    webcams.forEach(cam => {
        if (!cam.location) return;

        const { latitude, longitude } = cam.location;
        if (!latitude || !longitude) return;

        const icon = L.divIcon({
            className: 'webcam-marker',
            html: '<div class="webcam-marker-inner">🎥</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        const marker = L.marker([latitude, longitude], { icon });

        // Popup
        const thumbUrl = cam.images?.current?.preview || cam.images?.current?.icon || '';
        const popupContent = `
            <div class="popup-title">${escapeHtml(cam.title)}</div>
            <div class="popup-location">${escapeHtml(formatLocation(cam.location))}</div>
            ${thumbUrl ? `<img class="popup-thumb" src="${thumbUrl}" alt="${escapeHtml(cam.title)}" loading="lazy" />` : ''}
        `;
        marker.bindPopup(popupContent, { maxWidth: 260 });

        marker.on('click', () => {
            if (activeMarker) {
                activeMarker.getElement()?.classList.remove('webcam-marker-active');
            }
            activeMarker = marker;
            marker.getElement()?.classList.add('webcam-marker-active');
            showWebcamInfo(cam);
        });

        markerCluster.addLayer(marker);
    });
}

// ===== Show Webcam Info in Sidebar =====
function showWebcamInfo(cam) {
    webcamInfoEl.classList.remove('hidden');

    document.getElementById('infoTitle').textContent = cam.title || 'Brak nazwy';

    // Image
    const imageContainer = document.getElementById('infoImage');
    const imgUrl = cam.images?.current?.preview || cam.images?.current?.thumbnail || cam.images?.current?.icon || '';
    if (imgUrl) {
        imageContainer.innerHTML = `<img src="${imgUrl}" alt="${escapeHtml(cam.title)}" />`;
    } else {
        imageContainer.innerHTML = '<span style="color:rgba(255,255,255,0.3)">Brak podglądu</span>';
    }

    // Location
    document.getElementById('infoLocation').textContent = formatLocation(cam.location);
    document.getElementById('infoCountry').textContent =
        [cam.location?.country, cam.location?.continent].filter(Boolean).join(', ') || 'Nieznany';

    // Categories
    const cats = (cam.categories || []).map(c => c.name).join(', ');
    document.getElementById('infoCategories').textContent = cats || 'Brak';

    // Views
    document.getElementById('infoViews').textContent =
        cam.viewCount != null ? cam.viewCount.toLocaleString('pl-PL') : 'Brak danych';

    // Last update
    document.getElementById('infoUpdated').textContent =
        cam.lastUpdatedOn ? formatDate(cam.lastUpdatedOn) : 'Brak danych';

    // Status
    const statusEl = document.getElementById('infoStatus');
    statusEl.textContent = cam.status === 'active' ? '✅ Aktywna' : '⛔ Nieaktywna';

    // Player
    const playerContainer = document.getElementById('infoPlayer');
    if (cam.player?.day) {
        playerContainer.innerHTML = `<iframe src="${cam.player.day}" allowfullscreen></iframe>`;
    } else if (cam.player?.live) {
        playerContainer.innerHTML = `<iframe src="${cam.player.live}" allowfullscreen></iframe>`;
    } else {
        playerContainer.innerHTML = '';
    }

    // Links
    const detailLink = document.getElementById('infoDetailLink');
    if (cam.urls?.detail) {
        detailLink.href = cam.urls.detail;
        detailLink.style.display = 'inline-block';
    } else {
        detailLink.style.display = 'none';
    }

    // Scroll info into view
    webcamInfoEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== Search (Geocoding via Nominatim) =====
async function searchLocation(query) {
    if (!query.trim()) return;

    showLoading(true);

    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
        );
        const results = await response.json();

        if (results.length > 0) {
            const { lat, lon } = results[0];
            map.setView([parseFloat(lat), parseFloat(lon)], 10);
        } else {
            alert('Nie znaleziono miejsca. Spróbuj innej nazwy.');
        }
    } catch (err) {
        console.error('Błąd wyszukiwania:', err);
        alert('Nie udało się wyszukać lokalizacji.');
    } finally {
        showLoading(false);
    }
}

// ===== Utility Functions =====
function showLoading(visible) {
    loadingEl.classList.toggle('hidden', !visible);
}

function formatLocation(loc) {
    if (!loc) return 'Nieznana lokalizacja';
    return [loc.city, loc.region, loc.country].filter(Boolean).join(', ');
}

function formatDate(dateStr) {
    try {
        return new Date(dateStr).toLocaleString('pl-PL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateStr;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== Debounced Webcam Loading =====
function debouncedLoadWebcams() {
    clearTimeout(fetchTimeout);
    fetchTimeout = setTimeout(loadWebcams, 400);
}

// ===== Event Listeners =====

// Map events
map.on('moveend', debouncedLoadWebcams);
map.on('zoomend', debouncedLoadWebcams);

// Close info panel
closeInfoBtn.addEventListener('click', () => {
    webcamInfoEl.classList.add('hidden');
    if (activeMarker) {
        activeMarker.getElement()?.classList.remove('webcam-marker-active');
        activeMarker = null;
    }
});

// Search
searchBtn.addEventListener('click', () => searchLocation(searchInput.value));
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchLocation(searchInput.value);
});

// Category filter
categorySelect.addEventListener('change', loadWebcams);

// ===== Init =====
loadCategories();
loadWebcams();
