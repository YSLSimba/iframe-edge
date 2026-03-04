/* jshint esversion: 11 */
'use strict';

(function () {

    // ── Constants ────────────────────────────────────────────────────
    const ISS_API = 'https://api.wheretheiss.at/v1/satellites/25544';
    const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
    const DEFAULT_VIDEO_ID = 'itdOFB8DQCA';
    const TRAIL_LENGTH = 120;
    const ORBITAL_PERIOD_S = 92 * 60;

    // ── State ────────────────────────────────────────────────────────
    let settings = {
        videoId: localStorage.getItem('iss_video_id') || DEFAULT_VIDEO_ID,
        autoRotateSpeed: parseFloat(localStorage.getItem('iss_autorotate') ?? '3'),
    };

    let issData = { lat: 0, lon: 0, alt: 408, vel: 7660 };
    let trailPositions = [];
    let cockpitMode = false;
    let hintHidden = false;
    let ytPlayer = null;
    let isMuted = true;
    let geocodeCache = {};

    // ── DOM refs ─────────────────────────────────────────────────────
    const $ = (id) => document.getElementById(id);
    const globeZone = $('globeZone');
    const canvas = $('globeCanvas');
    const cockpitBtn = $('cockpitBtn');
    const muteBtn = $('muteBtn');
    const muteIcon = $('muteIcon');
    const unmuteIcon = $('unmuteIcon');
    const cityPopup = $('cityPopup');
    const popupName = $('cityPopupName');
    const popupPass = $('cityPopupPass');
    const globeHint = $('globeHint');
    const cockpitLabel = $('cockpitLabel');
    const valSpeed = $('valSpeed');
    const valAlt = $('valAlt');
    const valLat = $('valLat');
    const valLon = $('valLon');
    const settingsPanel = $('settingsPanel');
    const inputVideoId = $('inputVideoId');
    const inputAutoRotate = $('inputAutoRotate');
    const rotateVal = $('rotateVal');

    // ── Toast ─────────────────────────────────────────────────────────
    let toastTimer;
    function showToast(msg) {
        const t = $('toast');
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
    }

    // ── Settings panel ────────────────────────────────────────────────
    $('settingsToggle').addEventListener('click', () => {
        inputVideoId.value = settings.videoId;
        inputAutoRotate.value = settings.autoRotateSpeed;
        rotateVal.textContent = settings.autoRotateSpeed;
        settingsPanel.classList.add('open');
    });
    $('closeSettings').addEventListener('click', () => settingsPanel.classList.remove('open'));

    inputAutoRotate.addEventListener('input', () => {
        rotateVal.textContent = inputAutoRotate.value;
    });

    $('saveBtn').addEventListener('click', () => {
        const newId = inputVideoId.value.trim() || DEFAULT_VIDEO_ID;
        settings.autoRotateSpeed = parseFloat(inputAutoRotate.value);
        localStorage.setItem('iss_autorotate', settings.autoRotateSpeed);

        if (newId !== settings.videoId) {
            settings.videoId = newId;
            localStorage.setItem('iss_video_id', newId);
            reloadYT();
        }

        settingsPanel.classList.remove('open');
        showToast('✓ Settings saved');
    });

    inputVideoId.value = settings.videoId;
    inputAutoRotate.value = settings.autoRotateSpeed;
    rotateVal.textContent = settings.autoRotateSpeed;

    // ── YouTube IFrame API ───────────────────────────────────────────
    function buildYT(videoId) {
        if (typeof YT === 'undefined' || !YT.Player) return;
        const div = $('ytPlayer');
        div.innerHTML = '';
        const inner = document.createElement('div');
        inner.id = 'ytInner';
        div.appendChild(inner);

        ytPlayer = new YT.Player('ytInner', {
            videoId,
            playerVars: {
                autoplay: 1, mute: 1, controls: 0, modestbranding: 1,
                rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0,
            },
            width: '100%',
            height: '100%',
            events: {
                onReady: (e) => { e.target.playVideo(); isMuted = true; syncMuteUI(); },
                onError: () => showOfflinePlaceholder(),
            },
        });
    }

    function reloadYT() {
        if (ytPlayer && ytPlayer.destroy) ytPlayer.destroy();
        buildYT(settings.videoId);
    }

    function showOfflinePlaceholder() {
        const zone = $('videoZone');
        if (zone) zone.innerHTML = `
            <div class="video-offline">
                <div class="video-offline-icon">📡</div>
                <div>NASA live stream currently unavailable</div>
            </div>`;
    }

    window.onYouTubeIframeAPIReady = function () {
        buildYT(settings.videoId);
    };

    muteBtn.addEventListener('click', () => {
        if (!ytPlayer || !ytPlayer.isMuted) return;
        if (isMuted) { ytPlayer.unMute(); ytPlayer.setVolume(80); }
        else { ytPlayer.mute(); }
        isMuted = !isMuted;
        syncMuteUI();
    });

    function syncMuteUI() {
        muteIcon.classList.toggle('ui-hidden', !isMuted);
        unmuteIcon.classList.toggle('ui-hidden', isMuted);
    }

    // =====================================================================
    // ── THREE.JS 3D GLOBE (wrapped in try-catch — never crashes the rest)
    // =====================================================================
    let threeReady = false;
    let earth, nightSphere, issSprite, issRing, issSpriteMat, ringMat;
    let trailGeo, futureTrailGeo;

    try {
        if (typeof THREE === 'undefined') throw new Error('THREE.js not loaded');

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        camera.position.set(0, 0, 2.8);

        // Lights
        const ambientLight = new THREE.AmbientLight(0x334466, 2.5);
        scene.add(ambientLight);
        const sunLight = new THREE.DirectionalLight(0xffeedd, 2.2);
        sunLight.position.set(5, 3, 5);
        scene.add(sunLight);

        // Texture loader
        const texLoader = new THREE.TextureLoader();
        const earthGeo = new THREE.SphereGeometry(1, 64, 64);

        // Earth — fallback blue instantly, textures loaded async
        const earthMat = new THREE.MeshPhongMaterial({
            color: 0x1a4d7a,
            specular: new THREE.Color(0x224466),
            shininess: 18,
        });
        earth = new THREE.Mesh(earthGeo, earthMat);
        scene.add(earth);

        const TEX_BASE = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/';

        texLoader.load(TEX_BASE + 'earth-blue-marble.jpg',
            (tex) => { earthMat.map = tex; earthMat.specularMap = tex; earthMat.needsUpdate = true; },
            undefined,
            () => console.warn('[ISS] day texture failed')
        );
        texLoader.load(TEX_BASE + 'earth-topology.png',
            (tex) => { earthMat.bumpMap = tex; earthMat.bumpScale = 0.04; earthMat.needsUpdate = true; },
            undefined, () => { }
        );

        // Night lights overlay
        const nightMat = new THREE.MeshBasicMaterial({
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
        });
        nightSphere = new THREE.Mesh(new THREE.SphereGeometry(1.001, 64, 64), nightMat);
        scene.add(nightSphere);

        texLoader.load(TEX_BASE + 'earth-night.jpg',
            (tex) => { nightMat.map = tex; nightMat.needsUpdate = true; },
            undefined,
            () => { nightSphere.visible = false; }
        );

        // Atmosphere glow
        const atmMat = new THREE.ShaderMaterial({
            uniforms: { glowColor: { value: new THREE.Color(0x0044aa) } },
            vertexShader: `
                varying float vFresnel;
                void main() {
                    vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
                    vec3 viewDir = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
                    vFresnel = pow(1.0 - dot(worldNormal, viewDir), 3.5);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: `
                uniform vec3 glowColor;
                varying float vFresnel;
                void main() {
                    gl_FragColor = vec4(glowColor, vFresnel * 0.7);
                }`,
            side: THREE.FrontSide,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.06, 64, 64), atmMat));

        // Stars
        const starP = new Float32Array(2000 * 3);
        for (let i = 0; i < starP.length; i++) starP[i] = (Math.random() - 0.5) * 80;
        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute('position', new THREE.BufferAttribute(starP, 3));
        scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
            color: 0xffffff, size: 0.08, sizeAttenuation: true, transparent: true, opacity: 0.75,
        })));

        // ISS Sprite
        function makeISSTexture(size) {
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const ctx = c.getContext('2d');
            const cx = size / 2;
            const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
            grad.addColorStop(0, 'rgba(0,212,255,0.9)');
            grad.addColorStop(0.3, 'rgba(0,212,255,0.6)');
            grad.addColorStop(0.6, 'rgba(0,100,200,0.2)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, size, size);
            ctx.beginPath();
            ctx.arc(cx, cx, size * 0.12, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            return new THREE.CanvasTexture(c);
        }

        issSpriteMat = new THREE.SpriteMaterial({
            map: makeISSTexture(128), transparent: true,
            depthWrite: false, blending: THREE.AdditiveBlending,
        });
        issSprite = new THREE.Sprite(issSpriteMat);
        issSprite.scale.set(0.12, 0.12, 1);
        scene.add(issSprite);

        // Pulsing ring
        ringMat = new THREE.MeshBasicMaterial({
            color: 0x00d4ff, transparent: true, opacity: 0.5,
            side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        issRing = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.07, 32), ringMat);
        scene.add(issRing);

        // Past trail
        trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_LENGTH * 3), 3));
        scene.add(new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
            color: 0x00d4ff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending,
        })));

        // Future trail
        futureTrailGeo = new THREE.BufferGeometry();
        futureTrailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
        scene.add(new THREE.Line(futureTrailGeo, new THREE.LineBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending,
        })));

        // ── Drag rotation ────────────────────────────────────────────
        let isDragging = false, prevPointer = { x: 0, y: 0 }, velocity = { x: 0, y: 0 };
        const MAX_X = Math.PI / 2 - 0.1;

        canvas.addEventListener('pointerdown', (e) => {
            if (cockpitMode) return;
            isDragging = true;
            prevPointer = { x: e.clientX, y: e.clientY };
            velocity = { x: 0, y: 0 };
            hideHint();
        });
        canvas.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - prevPointer.x, dy = e.clientY - prevPointer.y, s = 0.006;
            earth.rotation.y += dx * s;
            earth.rotation.x += dy * s;
            nightSphere.rotation.y = earth.rotation.y;
            nightSphere.rotation.x = earth.rotation.x;
            velocity = { x: dx * s * 0.7, y: dy * s * 0.7 };
            prevPointer = { x: e.clientX, y: e.clientY };
        });
        const stopDrag = () => { isDragging = false; };
        canvas.addEventListener('pointerup', stopDrag);
        canvas.addEventListener('pointercancel', stopDrag);

        // ── Tap-to-locate ────────────────────────────────────────────
        const raycaster = new THREE.Raycaster();
        let tapStart = { x: 0, y: 0 };
        canvas.addEventListener('pointerdown', (e) => { tapStart = { x: e.clientX, y: e.clientY }; });
        canvas.addEventListener('pointerup', async (e) => {
            if (Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 6) return;
            const rect = canvas.getBoundingClientRect();
            const ndc = new THREE.Vector2(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -((e.clientY - rect.top) / rect.height) * 2 + 1
            );
            raycaster.setFromCamera(ndc, camera);
            const hits = raycaster.intersectObject(earth);
            if (!hits.length) return;
            const invM = new THREE.Matrix4().copy(earth.matrixWorld).invert();
            const lp = hits[0].point.clone().applyMatrix4(invM).normalize();
            const { lat, lon } = vec3ToLatLon(lp);
            showCityPopup(lat, lon, e.clientX - rect.left, e.clientY - rect.top);
            hideHint();
        });

        // ── Resize ───────────────────────────────────────────────────
        function resizeRenderer() {
            const w = globeZone.clientWidth, h = globeZone.clientHeight;
            if (!w || !h) return;
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        }
        requestAnimationFrame(resizeRenderer);
        new ResizeObserver(resizeRenderer).observe(globeZone);

        // ── Render loop ──────────────────────────────────────────────
        let pulseT = 0;
        (function animate() {
            requestAnimationFrame(animate);
            pulseT += 0.04;

            if (!isDragging && !cockpitMode && settings.autoRotateSpeed > 0) {
                const spd = settings.autoRotateSpeed * 0.00015;
                earth.rotation.y += spd;
                nightSphere.rotation.y += spd;
            }
            if (!isDragging && !cockpitMode) {
                if (Math.abs(velocity.x) > 0.0001 || Math.abs(velocity.y) > 0.0001) {
                    earth.rotation.y += velocity.x;
                    earth.rotation.x += velocity.y;
                    nightSphere.rotation.y = earth.rotation.y;
                    nightSphere.rotation.x = earth.rotation.x;
                    velocity.x *= 0.94;
                    velocity.y *= 0.94;
                }
            }
            earth.rotation.x = Math.max(-MAX_X, Math.min(MAX_X, earth.rotation.x));
            nightSphere.rotation.x = earth.rotation.x;

            const pulse = 1 + 0.3 * Math.sin(pulseT);
            if (issRing) { issRing.scale.set(pulse, pulse, 1); ringMat.opacity = 0.4 + 0.3 * Math.sin(pulseT); }
            if (issSpriteMat) issSpriteMat.opacity = 0.75 + 0.25 * Math.sin(pulseT * 1.2);

            renderer.render(scene, camera);
        })();

        threeReady = true;
        console.log('[ISS] Three.js initialized OK');

    } catch (err) {
        console.warn('[ISS] Three.js init failed — map & telemetry will still work:', err);
    }

    // =====================================================================
    // ── COORDINATE HELPERS (used by both 3D and 2D)
    // =====================================================================
    function latLonToVec3(lat, lon, radius) {
        if (typeof THREE === 'undefined') return null;
        radius = radius || 1.02;
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        return new THREE.Vector3(
            -radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta)
        );
    }

    function vec3ToLatLon(v) {
        const r = v.length();
        const lat = 90 - Math.acos(v.y / r) * (180 / Math.PI);
        let lon = Math.atan2(v.z, -v.x) * (180 / Math.PI) - 180;
        if (lon < -180) lon += 360;
        return { lat, lon };
    }

    // =====================================================================
    // ── 3D ISS POSITION UPDATE (only runs if Three.js initialized)
    // =====================================================================
    function update3DPosition(lat, lon) {
        if (!threeReady) return;
        try {
            const pos = latLonToVec3(lat, lon, 1.05);
            issSprite.position.copy(pos);
            issRing.position.copy(pos);
            issRing.lookAt(0, 0, 0);
            issRing.rotateX(Math.PI / 2);

            // Trail
            if (trailPositions.length === 0 ||
                Math.abs(lat - trailPositions[trailPositions.length - 1].lat) > 0.05 ||
                Math.abs(lon - trailPositions[trailPositions.length - 1].lon) > 0.05) {
                trailPositions.push({ lat, lon });
            }
            if (trailPositions.length > TRAIL_LENGTH) trailPositions.shift();

            const attr = trailGeo.attributes.position;
            const n = trailPositions.length;
            for (let i = 0; i < n; i++) {
                const v = latLonToVec3(trailPositions[i].lat, trailPositions[i].lon, 1.02);
                attr.setXYZ(i, v.x, v.y, v.z);
            }
            for (let i = n; i < TRAIL_LENGTH; i++) {
                const last = n > 0 ? trailPositions[n - 1] : { lat, lon };
                const v = latLonToVec3(last.lat, last.lon, 1.02);
                attr.setXYZ(i, v.x, v.y, v.z);
            }
            attr.needsUpdate = true;
            trailGeo.setDrawRange(0, n);

            // Future prediction
            const fAttr = futureTrailGeo.attributes.position;
            const stepLon = 360 / (ORBITAL_PERIOD_S / 60) * 2;
            let fLat = lat, fLon = lon;
            for (let i = 0; i < 60; i++) {
                fLon += stepLon;
                if (fLon > 180) fLon -= 360;
                const v = latLonToVec3(fLat, fLon, 1.02);
                fAttr.setXYZ(i, v.x, v.y, v.z);
            }
            fAttr.needsUpdate = true;
            futureTrailGeo.setDrawRange(0, 60);
        } catch (e) { /* ignore render errors */ }
    }

    // =====================================================================
    // ── TELEMETRY DISPLAY (always works)
    // =====================================================================
    function updateTelemetry(velocity, altitude, lat, lon) {
        valSpeed.textContent = Math.round(velocity * 1000 / 3600) + ' m/s';
        valAlt.textContent = Math.round(altitude) + ' km';
        valLat.textContent = (lat >= 0 ? lat.toFixed(2) + '°N' : Math.abs(lat).toFixed(2) + '°S');
        valLon.textContent = (lon >= 0 ? lon.toFixed(2) + '°E' : Math.abs(lon).toFixed(2) + '°W');
    }

    // =====================================================================
    // ── ISS API POLLING (always works — core of the widget)
    // =====================================================================
    async function fetchISS() {
        try {
            const r = await fetch(ISS_API);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const d = await r.json();

            issData = { lat: d.latitude, lon: d.longitude, alt: d.altitude, vel: d.velocity };

            // Update 3D globe
            update3DPosition(d.latitude, d.longitude);

            // Update telemetry panel
            updateTelemetry(d.velocity, d.altitude, d.latitude, d.longitude);

            // Update 2D map
            updateLeafletMap(d.latitude, d.longitude);

            // Cockpit mode
            if (cockpitMode) applyCockpitCamera();

        } catch (e) {
            console.warn('[ISS] fetch error:', e);
        }
    }

    fetchISS();
    setInterval(fetchISS, 2000);

    // =====================================================================
    // ── COCKPIT MODE
    // =====================================================================
    cockpitBtn.addEventListener('click', () => {
        cockpitMode = !cockpitMode;
        cockpitBtn.classList.toggle('cockpit-on', cockpitMode);
        cockpitLabel.classList.toggle('ui-hidden', !cockpitMode);
        if (cockpitMode) {
            applyCockpitCamera();
            showToast('🚀 Cockpit mode ON');
        } else {
            showToast('Cockpit mode OFF');
        }
        hideHint();
    });

    function applyCockpitCamera() {
        if (!threeReady || !earth) return;
        const targetY = -(issData.lon + 180) * Math.PI / 180;
        const targetX = -issData.lat * Math.PI / 180;
        earth.rotation.y = targetY;
        earth.rotation.x = targetX;
        nightSphere.rotation.y = targetY;
        nightSphere.rotation.x = targetX;
    }

    // =====================================================================
    // ── TAP-TO-LOCATE HELPERS
    // =====================================================================
    $('cityPopupClose').addEventListener('click', () => cityPopup.classList.add('hidden'));

    async function showCityPopup(lat, lon, sx, sy) {
        cityPopup.classList.remove('hidden');
        popupName.textContent = '…';
        popupPass.textContent = 'Calculating…';

        const zoneR = globeZone.getBoundingClientRect();
        const canR = canvas.getBoundingClientRect();
        const rx = canR.left - zoneR.left + sx, ry = canR.top - zoneR.top + sy;
        cityPopup.style.left = Math.max(8, Math.min(rx + 12, zoneR.width - 178)) + 'px';
        cityPopup.style.top = Math.max(8, Math.min(ry - 80, zoneR.height - 76)) + 'px';

        const name = await reverseGeocode(lat, lon);
        popupName.textContent = name;

        const etaMin = estimateNextPass(lat, lon);
        popupPass.textContent = etaMin < 120
            ? '🛸 ISS passes in ~' + etaMin + ' min'
            : '🛸 ISS ~' + Math.round(etaMin / 60) + 'h away';
    }

    async function reverseGeocode(lat, lon) {
        const key = lat.toFixed(1) + ',' + lon.toFixed(1);
        if (geocodeCache[key]) return geocodeCache[key];
        try {
            const r = await fetch(NOMINATIM + '?lat=' + lat + '&lon=' + lon + '&format=json', {
                headers: { 'Accept-Language': 'en', 'User-Agent': 'ISS-Horizon-Widget/1.0' }
            });
            const d = await r.json();
            const a = d.address || {};
            const name = a.city || a.town || a.village || a.county || a.state || a.country || 'Ocean';
            geocodeCache[key] = name;
            return name;
        } catch { return 'Unknown location'; }
    }

    function estimateNextPass(tLat, tLon) {
        if (Math.abs(tLat) > 51.6) return 9999;
        const dLon = ((tLon - issData.lon) + 360) % 360;
        return Math.round(dLon / (360 / ORBITAL_PERIOD_S) / 60);
    }

    function hideHint() {
        if (!hintHidden) { hintHidden = true; globeHint.classList.add('hidden'); }
    }

    // =====================================================================
    // ── LEAFLET 2D GROUND TRACK MAP (independent of Three.js)
    // =====================================================================
    let leafletMap = null, issMapMarker = null, issTrackLine = null;
    let mapTrackPts = [], mapFollowISS = true;

    function initLeafletMap() {
        if (typeof L === 'undefined') {
            console.warn('[ISS] Leaflet not loaded');
            return;
        }

        leafletMap = L.map('issMap', {
            zoomControl: false,
            attributionControl: false,
            dragging: true,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            keyboard: false,
        }).setView([20, 0], 2);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 18,
            subdomains: 'abcd',
        }).addTo(leafletMap);

        const issIcon = L.divIcon({
            className: 'iss-map-marker',
            html: '<div class="iss-dot-outer"><div class="iss-dot-inner"></div></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
        });

        issMapMarker = L.marker([0, 0], { icon: issIcon, zIndexOffset: 1000 }).addTo(leafletMap);

        issTrackLine = L.polyline([], {
            color: '#00d4ff', weight: 1.5, opacity: 0.55, className: 'iss-track-line',
        }).addTo(leafletMap);

        leafletMap.on('dragstart', () => {
            mapFollowISS = false;
            $('mapFollowBtn').classList.remove('active');
        });

        // Invalidate size once layout settles
        setTimeout(() => leafletMap.invalidateSize(), 200);
        console.log('[ISS] Leaflet map initialized OK');
    }

    function updateLeafletMap(lat, lon) {
        if (!issMapMarker) return;
        issMapMarker.setLatLng([lat, lon]);

        const last = mapTrackPts[mapTrackPts.length - 1];
        if (!last || Math.abs(lat - last[0]) > 0.04 || Math.abs(lon - last[1]) > 0.04) {
            if (last && Math.abs(lon - last[1]) > 160) {
                mapTrackPts = [[lat, lon]];
            } else {
                mapTrackPts.push([lat, lon]);
                if (mapTrackPts.length > 400) mapTrackPts.shift();
            }
            issTrackLine && issTrackLine.setLatLngs(mapTrackPts);
        }

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

})();
