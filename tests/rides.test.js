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

test('the ride panel hosts the trail map and loads Leaflet only on demand', () => {
    const src = fs.readFileSync(path.join(root, 'js/ride-log.js'), 'utf8');
    assert.match(src, /id="rideMap" class="ride-map"/);
    assert.match(src, /leaflet@1\.9\.4\/dist\/leaflet\.js/);
    assert.match(src, /if \(isRide\) ensureMap\(\);/);
    const pages = ['tracker.html', 'dashboard.html', 'index.html'];
    pages.forEach((rel) => assert.doesNotMatch(fs.readFileSync(path.join(root, rel), 'utf8'), /leaflet/i, `${rel} loads Leaflet eagerly`));
    const glass = fs.readFileSync(path.join(root, 'css/glass.css'), 'utf8');
    assert.match(glass, /\.leaflet-tile-pane \{ filter: grayscale\(1\)/);
});
