"use strict";

// Ustawienia API
const API_KEY = 'YOUR_API_KEY';
const API_BASE = 'https://api.windy.com/webcams/api/v3';

// Start mapy
const map = L.map('map', {
    center: [51.1, 17.0],
    zoom: 6,
    minZoom: 3,
    maxZoom: 18
});

// Podklad mapy
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Webcams by <a href="https://www.windy.com">Windy.com</a>'
}).addTo(map);

// Grupowanie markerow
const markers = L.markerClusterGroup({
    maxClusterRadius: 50,
    disableClusteringAtZoom: 15,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false
});
map.addLayer(markers);

const loadingEl = document.getElementById('loading');
const webcamCountEl = document.getElementById('webcamCount');
const webcamInfoEl = document.getElementById('webcamInfo');
const closeInfoBtn = document.getElementById('closeInfo');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const categorySelect = document.getElementById('categorySelect');

// Stan aplikacji
let webcams = [];
let activeMarker = null;
let fetchTimeout = null;

// Pobieranie danych z API
const api = async (path, params = {}) => {
    const url = new URL(API_BASE + path);
    Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v));
    const res = await fetch(url, { headers: { 'x-windy-api-key': API_KEY } });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
};

// Funkcje pomocnicze
const showLoading = (visible) => loadingEl.classList.toggle('hidden', !visible);
const formatLocation = (loc) => [loc?.city, loc?.region, loc?.country].filter(Boolean).join(', ') || 'Nieznana lokalizacja';
const formatDate = (dateStr) => {
    if (!dateStr) return 'Brak danych';
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleString('pl-PL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Lista kategorii do selecta
const loadCategories = async () => {
    try {
        const list = await api('/categories', { lang: 'pl' });
        list.forEach((cat) => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            categorySelect.appendChild(opt);
        });
    } catch (err) {
        console.warn('Nie udało się załadować kategorii:', err);
    }
};

// Rysowanie markerow na mapie
const renderMarkers = () => {
    markers.clearLayers();
    webcams.forEach((cam) => {
        const loc = cam.location;
        if (!loc?.latitude || !loc?.longitude) return;

        const icon = L.divIcon({
            className: 'webcam-marker',
            html: '<div class="webcam-marker-inner">🎥</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        const marker = L.marker([loc.latitude, loc.longitude], { icon });
        const thumb = cam.images?.current?.preview || cam.images?.current?.icon || '';
        marker.bindPopup(
            `<div class="popup-title">${cam.title || ''}</div>` +
            `<div class="popup-location">${formatLocation(loc)}</div>` +
            (thumb ? `<img class="popup-thumb" src="${thumb}" alt="${cam.title || ''}" loading="lazy" />` : ''),
            { maxWidth: 260 }
        );

        marker.on('click', () => {
            activeMarker?.getElement()?.classList.remove('webcam-marker-active');
            activeMarker = marker;
            marker.getElement()?.classList.add('webcam-marker-active');
            showWebcamInfo(cam);
        });

        markers.addLayer(marker);
    });
};

// Wypelnienie panelu z danymi
const showWebcamInfo = (cam) => {
    webcamInfoEl.classList.remove('hidden');

    document.getElementById('infoTitle').textContent = cam.title || 'Brak nazwy';
    document.getElementById('infoLocation').textContent = formatLocation(cam.location);
    document.getElementById('infoCountry').textContent = [cam.location?.country, cam.location?.continent].filter(Boolean).join(', ') || 'Nieznany';
    document.getElementById('infoCategories').textContent = (cam.categories || []).map((c) => c.name).join(', ') || 'Brak';
    document.getElementById('infoViews').textContent = cam.viewCount != null ? cam.viewCount.toLocaleString('pl-PL') : 'Brak danych';
    document.getElementById('infoUpdated').textContent = formatDate(cam.lastUpdatedOn);
    document.getElementById('infoStatus').textContent = cam.status === 'active' ? 'Aktywna' : 'Nieaktywna';

    const imgUrl = cam.images?.current?.preview || cam.images?.current?.thumbnail || cam.images?.current?.icon || '';
    document.getElementById('infoImage').innerHTML = imgUrl
        ? `<img src="${imgUrl}" alt="${cam.title || ''}" />`
        : '<span style="color:rgba(255,255,255,0.3)">Brak podglądu</span>';

    const player = cam.player?.day || cam.player?.live || '';
    document.getElementById('infoPlayer').innerHTML = player ? `<iframe src="${player}" allowfullscreen></iframe>` : '';

    const link = document.getElementById('infoDetailLink');
    if (cam.urls?.detail) {
        link.href = cam.urls.detail;
        link.style.display = 'inline-block';
    } else {
        link.style.display = 'none';
    }

    webcamInfoEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// Pobranie kamer z aktualnego widoku mapy
const loadWebcams = async () => {
    const b = map.getBounds();
    showLoading(true);
    try {
        const params = {
            include: 'categories,images,location,player,urls',
            lang: 'pl',
            limit: 50,
            bbox: `${b.getNorth()},${b.getEast()},${b.getSouth()},${b.getWest()}`
        };
        if (categorySelect.value) params.categories = categorySelect.value;

        const data = await api('/webcams', params);
        webcams = data.webcams || [];
        webcamCountEl.textContent = data.total || webcams.length;
        renderMarkers();
    } catch (err) {
        console.error('Błąd ładowania kamer:', err);
        webcamCountEl.textContent = '0';
    } finally {
        showLoading(false);
    }
};

// Szukanie miejsca po nazwie
const searchLocation = async (query) => {
    if (!query.trim()) return;
    showLoading(true);
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
        );
        const results = await res.json();
        if (results[0]) {
            map.setView([+results[0].lat, +results[0].lon], 10);
        } else {
            alert('Nie znaleziono miejsca. Spróbuj innej nazwy.');
        }
    } catch (err) {
        console.error('Błąd wyszukiwania:', err);
        alert('Nie udało się wyszukać lokalizacji.');
    } finally {
        showLoading(false);
    }
};

// Opoznienie zeby nie spamowac API
const debouncedLoadWebcams = () => {
    clearTimeout(fetchTimeout);
    fetchTimeout = setTimeout(loadWebcams, 800);
};

// Reakcja na ruch mapy
map.on('moveend', debouncedLoadWebcams);
map.on('zoomend', debouncedLoadWebcams);

// Zamkniecie panelu
closeInfoBtn.addEventListener('click', () => {
    webcamInfoEl.classList.add('hidden');
    activeMarker?.getElement()?.classList.remove('webcam-marker-active');
    activeMarker = null;
});

// Wyszukiwarka
searchBtn.addEventListener('click', () => searchLocation(searchInput.value));
searchInput.addEventListener('keydown', (e) => e.key === 'Enter' && searchLocation(searchInput.value));
categorySelect.addEventListener('change', loadWebcams);

// Start
loadCategories();
loadWebcams();
