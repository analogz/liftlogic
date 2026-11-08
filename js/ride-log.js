/**
 * LiftLogic — "Log Ride" tab for tracker.html
 * Requires js/rides-data.js. Rides are saved into the same `workouts`
 * array as lifts with `type: 'ride'` so LiftLogicSync carries them.
 */
(function () {
    const OTHER_VALUE = '__other__';

    function workoutsKey() {
        const user = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : 'default';
        return user === 'default' ? 'workouts' : `${user}_workouts`;
    }

    function readWorkouts() {
        try {
            const list = JSON.parse(localStorage.getItem(workoutsKey()) || '[]');
            return Array.isArray(list) ? list : [];
        } catch (e) {
            console.error('[Ride] Could not read workouts:', e);
            return [];
        }
    }

    function notify(msg, type) {
        if (typeof showNotification === 'function') showNotification(msg, type || 'success');
    }

    const esc = rideEscapeHtml;

    function fmtStats(distanceMi, climbFt) {
        const parts = [];
        if (distanceMi) parts.push(`${distanceMi} mi`);
        if (climbFt) parts.push(`${Number(climbFt).toLocaleString()} ft`);
        return parts.join(' · ');
    }

    function fmtDuration(min) {
        const m = parseInt(min, 10);
        if (!m) return '';
        const h = Math.floor(m / 60);
        return h ? `${h}h${String(m % 60).padStart(2, '0')}` : `${m}m`;
    }

    // ------------------------------------------------------------------
    // Markup
    // ------------------------------------------------------------------

    function typeOptions() {
        return Object.entries(RIDE_TYPES)
            .map(([key, t]) => `<option value="${esc(key)}">${esc(t.label)}</option>`)
            .join('');
    }

    function buildPanel() {
        const panel = document.getElementById('ridePanel');
        if (!panel) return;
        panel.innerHTML = `
            <h1>Log ride</h1>
            <form id="rideForm" class="ride-form" novalidate>
                <div class="card">
                    <h2>Ride</h2>
                    <div class="form-group">
                        <label for="rideSelect">Trail / Route</label>
                        <select id="rideSelect" required aria-required="true"></select>
                    </div>
                    <div class="form-group" id="rideCustomGroup" style="display:none;">
                        <label for="rideCustomName">Custom ride name</label>
                        <input type="text" id="rideCustomName" maxlength="80" placeholder="e.g. Saratoga Gap loop">
                    </div>
                    <div id="rideInfo" class="ride-info" style="display:none;"></div>
                    <div class="form-group ride-map-group">
                        <label for="rideMap">Trail map</label>
                        <div id="rideMap" class="ride-map" role="region" aria-label="Map of curated trails; choose a pin to pick that ride">Loading the trail map…</div>
                        <p class="ride-map-note">Pins mark the trailhead area, not the route. Tap a pin to pick that ride; open its route link for the line.</p>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="rideDate">Date</label>
                            <input type="date" id="rideDate" required aria-required="true">
                        </div>
                        <div class="form-group">
                            <label for="rideTime">Start time</label>
                            <input type="time" id="rideTime">
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="rideType">Ride type</label>
                        <select id="rideType">${typeOptions()}</select>
                    </div>
                    <div class="form-group">
                        <label>Bike</label>
                        <div class="radio-group">
                            <label class="radio-label"><input type="radio" name="rideBike" value="gravel" checked> Gravel</label>
                            <label class="radio-label"><input type="radio" name="rideBike" value="mtb"> MTB</label>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <h2>Stats</h2>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="rideDuration">Duration (min)</label>
                            <input type="number" id="rideDuration" min="1" max="1440" inputmode="numeric" required aria-required="true" placeholder="e.g. 120">
                        </div>
                        <div class="form-group">
                            <label for="rideDistance">Distance (mi)</label>
                            <input type="number" id="rideDistance" min="0" step="0.1" inputmode="decimal" placeholder="Optional">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="rideElevation">Elevation (ft)</label>
                            <input type="number" id="rideElevation" min="0" step="1" inputmode="numeric" placeholder="Optional">
                        </div>
                        <div class="form-group">
                            <label for="rideAvgHr">Avg HR (bpm)</label>
                            <input type="number" id="rideAvgHr" min="30" max="230" inputmode="numeric" placeholder="Optional">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="rideRpe">RPE (1-10)</label>
                        <input type="number" id="rideRpe" min="1" max="10" step="0.5" inputmode="decimal" placeholder="Optional">
                    </div>
                    <div class="form-group">
                        <label for="rideNotes">Notes</label>
                        <textarea id="rideNotes" maxlength="1000" placeholder="Conditions, lines, how the legs felt…"></textarea>
                    </div>
                </div>

                <button type="submit" class="btn btn-primary btn-full">Save Ride</button>
            </form>

            <div class="card" style="margin-top: var(--space-3);">
                <h2>Recent Rides</h2>
                <ul id="recentRidesList" class="ride-list"></ul>
            </div>
        `;
    }

    function populateRideSelect(selectedValue) {
        const select = document.getElementById('rideSelect');
        if (!select) return;
        const custom = getCustomRideNames(readWorkouts());

        let html = '<option value="">Choose a ride…</option>';
        getRidesByRegion().forEach(group => {
            html += `<optgroup label="${esc(group.region)}">`;
            group.rides.forEach(r => {
                const t = RIDE_TYPES[r.type];
                html += `<option value="${esc(r.id)}">${esc(r.name)}${t ? ' · ' + esc(t.label) : ''}</option>`;
            });
            html += '</optgroup>';
        });
        if (custom.length) {
            html += '<optgroup label="My rides">';
            custom.forEach(name => {
                html += `<option value="${esc('custom:' + name)}">${esc(name)}</option>`;
            });
            html += '</optgroup>';
        }
        html += `<optgroup label="Other"><option value="${OTHER_VALUE}">Other (custom)…</option></optgroup>`;
        select.innerHTML = html;
        if (selectedValue) select.value = selectedValue;
        onRideChange();
    }

    // ------------------------------------------------------------------
    // Trail map: Leaflet over a grayscale basemap, loaded the first time ride
    // mode is shown. One ink pin per curated ride; the chosen ride's pin grows.
    // ------------------------------------------------------------------
    const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    const TILE_URL = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
    const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM · <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)';
    let map = null;
    let markers = {};
    let leafletLoading = null;

    function loadLeaflet() {
        if (window.L) return Promise.resolve(window.L);
        if (leafletLoading) return leafletLoading;
        leafletLoading = new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = LEAFLET_CSS;
            link.onload = () => { if (map) map.invalidateSize(); };
            document.head.appendChild(link);
            const script = document.createElement('script');
            script.src = LEAFLET_JS;
            script.async = true;
            script.onload = () => resolve(window.L);
            script.onerror = () => reject(new Error('Leaflet failed to load'));
            document.head.appendChild(script);
        });
        return leafletLoading;
    }

    function pinStyle(on) {
        return { radius: on ? 9 : 6, fillColor: '#000', fillOpacity: 1, color: '#fff', weight: on ? 3 : 2 };
    }

    function ensureMap() {
        const el = document.getElementById('rideMap');
        if (!el) return;
        if (map) { setTimeout(() => map.invalidateSize(), 50); return; }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            el.classList.add('is-offline');
            el.textContent = 'The trail map needs a connection.';
            return;
        }
        loadLeaflet().then((L) => {
            if (map || !document.getElementById('rideMap')) return;
            el.textContent = '';
            map = L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
            L.tileLayer(TILE_URL, { maxZoom: 17, subdomains: 'abc', attribution: TILE_ATTR }).addTo(map);
            const points = [];
            RIDES.forEach((ride) => {
                if (typeof ride.lat !== 'number' || typeof ride.lng !== 'number') return;
                const marker = L.circleMarker([ride.lat, ride.lng], pinStyle(false)).addTo(map);
                marker.bindTooltip(ride.name, { direction: 'top', offset: [0, -8], className: 'ride-map-tip' });
                marker.on('click', () => {
                    const select = document.getElementById('rideSelect');
                    if (!select) return;
                    select.value = ride.id;
                    onRideChange();
                });
                markers[ride.id] = marker;
                points.push([ride.lat, ride.lng]);
            });
            if (points.length) map.fitBounds(points, { padding: [24, 24] });
            const select = document.getElementById('rideSelect');
            highlightRide(select ? select.value : null, true);
        }).catch(() => {
            el.classList.add('is-offline');
            el.textContent = 'The trail map could not load.';
        });
    }

    function highlightRide(id, keepView) {
        if (!map) return;
        const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        Object.entries(markers).forEach(([rid, marker]) => {
            const on = rid === id;
            marker.setStyle(pinStyle(on));
            if (on) {
                marker.bringToFront();
                if (!keepView) {
                    const zoom = Math.max(map.getZoom(), 11);
                    if (reduce) map.setView(marker.getLatLng(), zoom);
                    else map.flyTo(marker.getLatLng(), zoom, { duration: 0.6 });
                }
            }
        });
    }

    function onRideChange() {
        const select = document.getElementById('rideSelect');
        const info = document.getElementById('rideInfo');
        const customGroup = document.getElementById('rideCustomGroup');
        if (!select || !info) return;
        const value = select.value;

        customGroup.style.display = value === OTHER_VALUE ? '' : 'none';
        if (value === OTHER_VALUE) document.getElementById('rideCustomName').focus();

        const ride = getRideById(value);
        const dist = document.getElementById('rideDistance');
        const elev = document.getElementById('rideElevation');
        if (!ride) {
            info.style.display = 'none';
            info.innerHTML = '';
            dist.placeholder = 'Optional';
            elev.placeholder = 'Optional';
            highlightRide(null);
            return;
        }
        highlightRide(ride.id);

        // Pre-select type + bike from the catalog, but never invent stats:
        // route numbers are shown as placeholders only.
        document.getElementById('rideType').value = ride.type;
        const bike = ride.type === 'gravel' ? 'gravel' : 'mtb';
        const bikeInput = document.querySelector(`input[name="rideBike"][value="${bike}"]`);
        if (bikeInput) bikeInput.checked = true;
        dist.placeholder = ride.distanceMi ? `Route ≈ ${ride.distanceMi}` : 'Optional';
        elev.placeholder = ride.climbFt ? `Route ≈ ${ride.climbFt}` : 'Optional';

        const t = RIDE_TYPES[ride.type];
        const stats = fmtStats(ride.distanceMi, ride.climbFt);
        info.innerHTML = `
            <div class="ride-info-meta">${esc(t ? t.label : ride.type)} · ${esc(ride.difficulty || '')}${stats ? ' · ' + esc(stats) : ''}</div>
            <div>${esc(ride.note)}</div>
            ${ride.restriction ? `<div class="ride-info-rule"><span class="icon icon--sm" data-icon="alert" aria-hidden="true"></span> ${esc(ride.restriction)}</div>` : ''}
            <div class="ride-info-rule"><a href="${esc(ride.manager || ride.source)}" target="_blank" rel="noopener">Rules &amp; conditions <span class="icon icon--sm" data-icon="external" aria-hidden="true"></span></a>
            ${ride.source && ride.source !== ride.manager ? ` · <a href="${esc(ride.source)}" target="_blank" rel="noopener">Route <span class="icon icon--sm" data-icon="external" aria-hidden="true"></span></a>` : ''}</div>
        `;
        info.style.display = '';
    }

    function renderRecentRides() {
        const list = document.getElementById('recentRidesList');
        if (!list) return;
        const rides = summarizeRides(readWorkouts()).recent.slice(0, 8);
        if (!rides.length) {
            list.innerHTML = '<li class="ride-empty">No rides logged yet.</li>';
            return;
        }
        list.innerHTML = rides.map(r => {
            const t = RIDE_TYPES[r.rideType];
            const stats = [fmtStats(r.distanceMi, r.elevationFt), fmtDuration(r.durationMin)].filter(Boolean).join(' · ');
            return `
                <li class="ride-list-item">
                    <div>
                        <div class="ride-list-name">${esc(r.rideName || 'Ride')}</div>
                        <div class="ride-list-sub">${esc(r.date)}${t ? ' · ' + esc(t.label) : ''}${r.bike ? ' · ' + esc(r.bike === 'mtb' ? 'MTB' : 'Gravel') : ''}</div>
                    </div>
                    <div class="ride-list-stats">${esc(stats)}</div>
                </li>`;
        }).join('');
    }

    // ------------------------------------------------------------------
    // Save
    // ------------------------------------------------------------------

    function numOrNull(id, parser) {
        const raw = document.getElementById(id).value;
        if (raw === '' || raw == null) return null;
        const v = parser(raw);
        return isNaN(v) ? null : v;
    }

    function collectRide() {
        const selectValue = document.getElementById('rideSelect').value;
        let rideId = null;
        let rideName = '';
        let region = null;

        if (selectValue === OTHER_VALUE) {
            rideName = document.getElementById('rideCustomName').value.trim().slice(0, 80);
            rideId = 'custom';
        } else if (selectValue.startsWith('custom:')) {
            rideName = selectValue.slice('custom:'.length);
            rideId = 'custom';
        } else {
            const ride = getRideById(selectValue);
            if (ride) {
                rideId = ride.id;
                rideName = ride.name;
                region = ride.region;
            }
        }

        return {
            selectValue,
            entry: {
                type: 'ride',
                date: document.getElementById('rideDate').value,
                time: document.getElementById('rideTime').value || null,
                rideId,
                rideName,
                region,
                rideType: document.getElementById('rideType').value,
                bike: (document.querySelector('input[name="rideBike"]:checked') || {}).value || null,
                durationMin: numOrNull('rideDuration', v => parseInt(v, 10)),
                distanceMi: numOrNull('rideDistance', parseFloat),
                elevationFt: numOrNull('rideElevation', v => parseInt(v, 10)),
                avgHr: numOrNull('rideAvgHr', v => parseInt(v, 10)),
                rpe: numOrNull('rideRpe', parseFloat),
                notes: document.getElementById('rideNotes').value.trim().slice(0, 1000),
                exercises: [] // keeps legacy lifting code paths safe
            }
        };
    }

    function saveRide(e) {
        e.preventDefault();
        const { selectValue, entry } = collectRide();

        if (!selectValue) return notify('Choose a ride', 'error');
        if (!entry.rideName) return notify('Enter a name for your custom ride', 'error');
        if (!entry.date) return notify('Pick a date', 'error');
        if (!entry.durationMin || entry.durationMin <= 0) return notify('Enter ride duration (minutes)', 'error');
        if (entry.rpe != null && (entry.rpe < 1 || entry.rpe > 10)) return notify('RPE must be 1-10', 'error');

        try {
            entry.id = `ride_${entry.date}_${Date.now()}`;
            entry.createdAt = new Date().toISOString();
            entry.updatedAt = Date.now();
            const workouts = readWorkouts();
            workouts.push(entry);
            localStorage.setItem(workoutsKey(), JSON.stringify(workouts));

            let keepSelected = selectValue;
            if (entry.rideId === 'custom') {
                saveCustomRideName(entry.rideName);
                keepSelected = 'custom:' + entry.rideName;
            }

            notify(`Ride saved: ${entry.rideName}`, 'success');

            if (typeof LiftLogicSync !== 'undefined' && typeof LiftLogicAuth !== 'undefined' && LiftLogicAuth.isSignedIn()) {
                LiftLogicSync.uploadSingleWorkout(entry).then(result => {
                    if (result && result.success) notify('Ride synced to cloud', 'success');
                });
            }

            resetRideForm(keepSelected);
            renderRecentRides();
        } catch (err) {
            console.error('[Ride] Save failed:', err);
            notify('Ride save failed', 'error');
        }
    }

    function resetRideForm(selectedValue) {
        const form = document.getElementById('rideForm');
        form.reset();
        const now = new Date();
        document.getElementById('rideDate').value = rideLocalDateStr(now);
        document.getElementById('rideTime').value = now.toTimeString().slice(0, 5);
        populateRideSelect(selectedValue || '');
    }

    // ------------------------------------------------------------------
    // Mode toggle + Saturday cycling prompt
    // ------------------------------------------------------------------

    function setTrackerMode(mode) {
        const isRide = mode === 'ride';
        const workoutPanel = document.getElementById('workoutPanel');
        const ridePanel = document.getElementById('ridePanel');
        if (workoutPanel) workoutPanel.style.display = isRide ? 'none' : '';
        if (ridePanel) ridePanel.style.display = isRide ? '' : 'none';
        if (isRide) ensureMap();

        const wBtn = document.getElementById('modeWorkoutBtn');
        const rBtn = document.getElementById('modeRideBtn');
        if (wBtn) { wBtn.classList.toggle('active', !isRide); wBtn.setAttribute('aria-selected', String(!isRide)); }
        if (rBtn) { rBtn.classList.toggle('active', isRide); rBtn.setAttribute('aria-selected', String(isRide)); }

        const banner = document.getElementById('cyclingDayBanner');
        if (banner && isRide) banner.style.display = 'none';
        else if (banner && isCyclingDay()) banner.style.display = '';

        try {
            const url = new URL(window.location.href);
            if (isRide) url.searchParams.set('mode', 'ride');
            else url.searchParams.delete('mode');
            history.replaceState(null, '', url.toString());
        } catch (e) { /* ignore */ }

        document.querySelectorAll('[data-nav="workout"], [data-nav="ride"]').forEach(a => {
            const on = (a.dataset.nav === 'ride') === isRide;
            a.classList.toggle('active', on);
            if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        });

        if (isRide) renderRecentRides();
    }

    function todaysScheduleDay() {
        if (typeof SCHEDULE_DATA === 'undefined') return null;
        const idx = (new Date().getDay() + 6) % 7; // Mon=0 … Sun=6
        return SCHEDULE_DATA.days[idx] || null;
    }

    function isCyclingDay() {
        const day = todaysScheduleDay();
        return !!(day && /cycl/i.test(day.focus || ''));
    }

    function setupCyclingBanner() {
        const banner = document.getElementById('cyclingDayBanner');
        if (!banner) return;
        const day = todaysScheduleDay();
        if (!isCyclingDay()) { banner.style.display = 'none'; return; }
        banner.innerHTML = `
            <span><span class="icon icon--sm" data-icon="ride" aria-hidden="true"></span> ${esc(day.name)} is ${esc(day.focus)} day.</span>
            <button type="button" onclick="setTrackerMode('ride')">Log a ride <span class="icon icon--sm" data-icon="arrow" aria-hidden="true"></span></button>
        `;
        banner.style.display = '';
    }

    function init() {
        if (!document.getElementById('ridePanel')) return;
        buildPanel();
        resetRideForm('');
        document.getElementById('rideSelect').addEventListener('change', onRideChange);
        document.getElementById('rideType').addEventListener('change', (e) => {
            // Sensible default: gravel rides on the gravel bike, dirt types on the MTB
            const bike = e.target.value === 'gravel' || e.target.value === 'road' ? 'gravel' : 'mtb';
            const input = document.querySelector(`input[name="rideBike"][value="${bike}"]`);
            if (input) input.checked = true;
        });
        document.getElementById('rideForm').addEventListener('submit', saveRide);
        setupCyclingBanner();

        // On the tracker itself, the bottom-nav Workout/Ride items toggle mode without a reload
        document.querySelectorAll('[data-nav="workout"], [data-nav="ride"]').forEach(a => {
            a.addEventListener('click', e => {
                e.preventDefault();
                setTrackerMode(a.dataset.nav === 'ride' ? 'ride' : 'workout');
                window.scrollTo(0, 0);
            });
        });

        const params = new URLSearchParams(window.location.search);
        const wantsRide = params.get('mode') === 'ride' || window.location.hash === '#ride';
        setTrackerMode(wantsRide ? 'ride' : 'workout');
    }

    window.setTrackerMode = setTrackerMode;
    window.LiftLogicRideLog = { init, setTrackerMode, renderRecentRides, populateRideSelect };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
