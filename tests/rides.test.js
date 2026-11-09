/**
 * Every curated ride carries an approximate trailhead pin inside the Bay Area,
 * and the ride panel hosts the trail map.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const vm = require('vm');

const root = path.join(__dirname, '..');

test('every ride has a Bay Area trailhead pin and a unique id', () => {
    const sandbox = { window: {}, console };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    const rides = vm.runInContext(fs.readFileSync(path.join(root, 'js/rides-data.js'), 'utf8') + '\n;RIDES', sandbox);
    assert.ok(Array.isArray(rides) && rides.length >= 20);
    const ids = new Set();
    rides.forEach((ride) => {
        assert.ok(!ids.has(ride.id), `duplicate id ${ride.id}`);
        ids.add(ride.id);
        assert.strictEqual(typeof ride.lat, 'number', `${ride.id} lat`);
        assert.strictEqual(typeof ride.lng, 'number', `${ride.id} lng`);
        assert.ok(ride.lat > 36.3 && ride.lat < 38.4, `${ride.id} lat ${ride.lat}`);
        assert.ok(ride.lng > -123.2 && ride.lng < -121.2, `${ride.id} lng ${ride.lng}`);
    });
});

test('the ride panel hosts the trail map and loads MapLibre only on demand', () => {
    const src = fs.readFileSync(path.join(root, 'js/ride-log.js'), 'utf8');
    assert.match(src, /id="rideMap" class="ride-map"/);
    assert.match(src, /maplibre-gl@6\.17\.0\/dist\/maplibre-gl\.mjs/);
    assert.match(src, /tiles\.openfreemap\.org\/styles\/positron/);
    assert.match(src, /elevation-tiles-prod\/terrarium/);
    assert.match(src, /OpenStreetMap<\/a> \(ODbL\)/);
    assert.match(src, /if \(isRide\) ensureMap\(\);/);
    assert.match(src, /IntersectionObserver/);
    assert.doesNotMatch(src, /leaflet/i);
    const pages = ['tracker.html', 'dashboard.html', 'index.html'];
    pages.forEach((rel) => assert.doesNotMatch(fs.readFileSync(path.join(root, rel), 'utf8'), /maplibre|leaflet/i, `${rel} loads the map eagerly`));
    const glass = fs.readFileSync(path.join(root, 'css/glass.css'), 'utf8');
    assert.match(glass, /\.maplibregl-ctrl-group/);
    assert.doesNotMatch(glass, /leaflet/);
});

test('route files are small OSM lines and a missing file falls back to the pin', () => {
    const src = fs.readFileSync(path.join(root, 'js/ride-log.js'), 'utf8');
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.match(src, /assets\/rides\/' \+ id \+ '\.geojson'/);
    assert.match(src, /if \(!res\.ok\) \{\s*routeCache\[id\] = null;\s*return null;/);
    assert.match(src, /\.catch\(\(\) => null\)/);
    assert.match(sw, /\.geojson/);
    assert.match(sw, /const CACHE_NAME = 'liftlogic-v25'/);

    const sandbox = { window: {}, console };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    const rides = vm.runInContext(fs.readFileSync(path.join(root, 'js/rides-data.js'), 'utf8') + '\n;RIDES', sandbox);
    const byId = new Map(rides.map((ride) => [ride.id, ride]));
    const dir = path.join(root, 'assets/rides');
    const files = fs.readdirSync(dir).filter((name) => name.endsWith('.geojson'));
    const required = [
        'purisima-creek', 'el-corte-de-madera', 'arastradero', 'windy-hill-spring-ridge',
        'planet-of-the-apes', 'skyline-ridge-linkup', 'alpine-road-dirt', 'skyline-watershed-ridge'
    ];
    required.forEach((id) => assert.ok(files.includes(id + '.geojson'), `missing route ${id}`));
    assert.ok(files.length >= 18);

    files.forEach((name) => {
        const id = name.replace(/\.geojson$/, '');
        const ride = byId.get(id);
        assert.ok(ride, `${name} is not a catalog ride`);
        const raw = fs.readFileSync(path.join(dir, name));
        assert.ok(raw.length < 20000, `${name} is ${raw.length} bytes`);
        const feature = JSON.parse(raw.toString('utf8'));
        assert.strictEqual(feature.type, 'Feature');
        assert.strictEqual(feature.geometry.type, 'LineString');
        assert.strictEqual(feature.properties.id, id);
        assert.match(feature.properties.license, /ODbL/);
        const coords = feature.geometry.coordinates;
        assert.ok(coords.length >= 8, `${id} has ${coords.length} points`);
        let nearest = Infinity;
        coords.forEach((pair, i) => {
            assert.strictEqual(pair.length, 2, `${id} coord ${i}`);
            const [lng, lat] = pair;
            assert.ok(lat > 36.2 && lat < 38.6, `${id} lat ${lat}`);
            assert.ok(lng > -123.3 && lng < -121.1, `${id} lng ${lng}`);
            const dLat = (lat - ride.lat) * 111320;
            const dLng = (lng - ride.lng) * 111320 * Math.cos(ride.lat * Math.PI / 180);
            nearest = Math.min(nearest, Math.hypot(dLat, dLng));
            if (i > 0) {
                const prev = coords[i - 1];
                const stepLat = (lat - prev[1]) * 111320;
                const stepLng = (lng - prev[0]) * 111320 * Math.cos(lat * Math.PI / 180);
                // Long chords are nearly straight fire roads after simplification, not teleports.
                assert.ok(Math.hypot(stepLat, stepLng) < 2000, `${id} jumps ${Math.round(Math.hypot(stepLat, stepLng))}m`);
            }
        });
        assert.ok(nearest < 8000, `${id} is ${Math.round(nearest)}m from its trailhead`);
        assert.match(sw, new RegExp(`\\./assets/rides/${id}\\.geojson`));
    });
});
