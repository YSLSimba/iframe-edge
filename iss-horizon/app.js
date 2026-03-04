/* jshint esversion: 11 */
'use strict';

(function () {

    // ── Constants ────────────────────────────────────────────────────
    const ISS_API = 'https://api.wheretheiss.at/v1/satellites/25544';
    // ── ISS Live Sources ──────────────────────────────────────────────
    const SOURCES = [
        { id: 'zPH5KtjJFaQ', name: 'HD Views' },
        { id: 'FV4Q9DryTG8', name: 'Live Video' },
        { id: '0FBiyFpV__g', name: '24/7 Stream' },
    ];
    let currentSource = 0;

    // ── State ────────────────────────────────────────────────────────
    let settings = {
        videoId: localStorage.getItem('iss_video_id') || SOURCES[0].id,
    };

    let issData = { lat: 0, lon: 0, alt: 408, vel: 7660 };

    // ── DOM refs ─────────────────────────────────────────────────────
    const $ = (id) => document.getElementById(id);
    const ytIframe = $('ytIframe');
    const valSpeed = $('valSpeed');
    const valAlt = $('valAlt');
    const valLat = $('valLat');
    const valLon = $('valLon');
    const settingsPanel = $('settingsPanel');
    const inputVideoId = $('inputVideoId');

    // ── Toast ─────────────────────────────────────────────────────────
    let toastTimer;
    function showToast(msg) {
        const t = $('toast');
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
    }

    // ── YouTube iframe helpers ────────────────────────────────────────
    function buildYTUrl(videoId) {
        return 'https://www.youtube.com/embed/' + videoId +
            '?autoplay=1&mute=1&modestbranding=1&rel=0&playsinline=1';
    }

    function loadVideo(videoId) {
        ytIframe.src = buildYTUrl(videoId);
    }

    // ── Source switch button ──────────────────────────────────────────
    $('sourceBtn').addEventListener('click', () => {
        currentSource = (currentSource + 1) % SOURCES.length;
        const src = SOURCES[currentSource];
        settings.videoId = src.id;
        localStorage.setItem('iss_video_id', src.id);
        loadVideo(src.id);
        $('sourceName').textContent = src.name;
        showToast('📷 ' + src.name);
    });

    // Init: match saved ID to source index
    const savedIdx = SOURCES.findIndex(s => s.id === settings.videoId);
    if (savedIdx >= 0) {
        currentSource = savedIdx;
        $('sourceName').textContent = SOURCES[savedIdx].name;
    }

    // ── Settings panel ────────────────────────────────────────────────
    $('settingsToggle').addEventListener('click', () => {
        inputVideoId.value = settings.videoId;
        settingsPanel.classList.add('open');
    });
    $('closeSettings').addEventListener('click', () => settingsPanel.classList.remove('open'));

    $('saveBtn').addEventListener('click', () => {
        const newId = inputVideoId.value.trim() || SOURCES[0].id;

        if (newId !== settings.videoId) {
            settings.videoId = newId;
            localStorage.setItem('iss_video_id', newId);
            loadVideo(newId);
        }

        settingsPanel.classList.remove('open');
        showToast('✓ Settings saved');
    });

    inputVideoId.value = settings.videoId;

    // =====================================================================
    // ── TELEMETRY DISPLAY
    // =====================================================================
    function updateTelemetry(velocity, altitude, lat, lon) {
        valSpeed.textContent = Math.round(velocity * 1000 / 3600) + ' m/s';
        valAlt.textContent = Math.round(altitude) + ' km';
        valLat.textContent = (lat >= 0 ? lat.toFixed(2) + '°N' : Math.abs(lat).toFixed(2) + '°S');
        valLon.textContent = (lon >= 0 ? lon.toFixed(2) + '°E' : Math.abs(lon).toFixed(2) + '°W');
    }

    // =====================================================================
    // ── ISS API POLLING
    // =====================================================================
    async function fetchISS() {
        try {
            const r = await fetch(ISS_API);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const d = await r.json();

            issData = { lat: d.latitude, lon: d.longitude, alt: d.altitude, vel: d.velocity };

            // Cache all telemetry for instant first paint on next load
            localStorage.setItem('iss_cache', JSON.stringify(issData));

            // Update telemetry panel
            updateTelemetry(d.velocity, d.altitude, d.latitude, d.longitude);

            // Update 2D map
            updateLeafletMap(d.latitude, d.longitude);

        } catch (e) {
            console.warn('[ISS] fetch error:', e);
        }
    }

    fetchISS();
    setInterval(fetchISS, 2000);

    // =====================================================================
    // ── ORBITAL GROUND TRACK COMPUTATION
    // =====================================================================
    const INCLINATION = 51.6;                         // degrees
    const ORBITAL_PERIOD = 92.68 * 60;                // seconds (~92.68 min)
    const EARTH_ROT_RATE = 360 / 86400;               // deg/s
    const GROUND_TRACK_RATE = 360 / ORBITAL_PERIOD - EARTH_ROT_RATE; // deg/s eastward
    const ORBIT_RANGE = ORBITAL_PERIOD * 6;            // 6 orbits each way → fills all visible world copies
    const ORBIT_STEP = 60;                             // seconds between points (60 s = smooth enough + fast)

    let prevLat = null;
    let isAscending = true;


    /**
     * Compute orbital ground track points relative to a known position.
     * Returns { pastPoints, futurePoints }.
     */
    function computeOrbitTrack(lat, lon, ascending) {
        const inc = INCLINATION;
        const clampedLat = Math.max(-inc, Math.min(inc, lat));

        // Determine current orbital phase from latitude
        let phase0 = Math.asin(clampedLat / inc);
        if (!ascending) phase0 = Math.PI - phase0;

        const pastPts = [];
        const futurePts = [];

        // Past orbit — keep longitude continuous (no wrap) so Leaflet draws
        // across repeated world-copy tiles without any splits.
        for (let dt = -ORBIT_RANGE; dt <= 0; dt += ORBIT_STEP) {
            const phase = phase0 + (2 * Math.PI / ORBITAL_PERIOD) * dt;
            const newLat = inc * Math.sin(phase);
            const newLon = lon + GROUND_TRACK_RATE * dt;   // unwrapped
            pastPts.push([newLat, newLon]);
        }

        // Future orbit — same approach
        for (let dt = 0; dt <= ORBIT_RANGE; dt += ORBIT_STEP) {
            const phase = phase0 + (2 * Math.PI / ORBITAL_PERIOD) * dt;
            const newLat = inc * Math.sin(phase);
            const newLon = lon + GROUND_TRACK_RATE * dt;   // unwrapped
            futurePts.push([newLat, newLon]);
        }

        return { pastPts, futurePts };
    }

    // =====================================================================
    // ── LEAFLET 2D GROUND TRACK MAP
    // =====================================================================
    let leafletMap = null, issMapMarker = null;
    let pastPolylines = [], futurePolylines = [];
    let mapFollowISS = true;

    function initLeafletMap() {
        if (typeof L === 'undefined') {
            console.warn('[ISS] Leaflet not loaded');
            return;
        }

        leafletMap = L.map('issMap', {
            zoomControl: true,
            attributionControl: false,
            dragging: true,
            scrollWheelZoom: true,
            doubleClickZoom: true,
            keyboard: true,
            minZoom: 2,
            maxZoom: 6,
        }).setView([20, 0], 2);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 6,
            subdomains: 'abcd',
        }).addTo(leafletMap);

        // ISS marker
        const issIcon = L.divIcon({
            className: 'iss-map-marker',
            html: '<div class="iss-dot-outer"><div class="iss-dot-inner"></div></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
        });
        issMapMarker = L.marker([0, 0], { icon: issIcon, zIndexOffset: 1000 }).addTo(leafletMap);

        // Pre-create polylines for orbit tracks (reused each update to avoid flicker)
        // We create a pool; excess lines are hidden, missing ones are added on demand.
        pastPolylines = [];
        futurePolylines = [];

        leafletMap.on('dragstart', () => {
            mapFollowISS = false;
            $('mapFollowBtn').classList.remove('active');
        });

        setTimeout(() => leafletMap.invalidateSize(), 200);
        console.log('[ISS] Leaflet map initialized OK');
    }

    function updateLeafletMap(lat, lon) {
        if (!issMapMarker) return;
        issMapMarker.setLatLng([lat, lon]);

        // Determine ascending / descending
        if (prevLat !== null) {
            isAscending = lat > prevLat;
        }
        prevLat = lat;

        // Compute orbital tracks
        const { pastPts, futurePts } = computeOrbitTrack(lat, lon, isAscending);

        // ── Update orbit polylines in-place (no clearLayers → no flicker) ──
        function syncPolylines(pool, segments, style) {
            // Update existing polylines
            segments.forEach((seg, i) => {
                if (pool[i]) {
                    pool[i].setLatLngs(seg);
                } else {
                    pool[i] = L.polyline(seg, style).addTo(leafletMap);
                }
            });
            // Hide (remove) surplus polylines
            for (let i = segments.length; i < pool.length; i++) {
                leafletMap.removeLayer(pool[i]);
            }
            pool.length = segments.length;
        }

        // Render past orbit (white) — single continuous polyline, no split needed
        syncPolylines(pastPolylines, [pastPts], {
            color: '#ffffff',
            weight: 1.8,
            opacity: 0.45,
            className: 'orbit-past-line',
        });

        // Render future orbit (yellow) — same
        syncPolylines(futurePolylines, [futurePts], {
            color: '#ffd700',
            weight: 1.8,
            opacity: 0.55,
            dashArray: '6, 4',
            className: 'orbit-future-line',
        });

        // Follow ISS
        if (mapFollowISS && leafletMap) {
            leafletMap.panTo([lat, lon], { animate: true, duration: 0.8 });
        }
    }

    $('mapFollowBtn').addEventListener('click', () => {
        mapFollowISS = !mapFollowISS;
        $('mapFollowBtn').classList.toggle('active', mapFollowISS);
        if (mapFollowISS && leafletMap) {
            leafletMap.panTo([issData.lat, issData.lon], { animate: true });
        }
    });

    // Start Leaflet
    initLeafletMap();

    // Render track + telemetry immediately with cached data (before API responds)
    try {
        const cached = JSON.parse(localStorage.getItem('iss_cache'));
        if (cached && !isNaN(cached.lat) && !isNaN(cached.lon)) {
            issData = cached;
            updateTelemetry(cached.vel, cached.alt, cached.lat, cached.lon);
            updateLeafletMap(cached.lat, cached.lon);
        }
    } catch (_) { /* no cache yet */ }

})();
