/**
 * The glass skin is grayscale, and the bundled village art is the
 * original WebP bytes (not a re-encode).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const vm = require('vm');

const root = path.join(__dirname, '..');

function webpSize(data) {
    assert.strictEqual(data.slice(0, 4).toString(), 'RIFF');
    assert.strictEqual(data.slice(8, 12).toString(), 'WEBP');
    assert.strictEqual(data.slice(12, 16).toString(), 'VP8 ');
    const o = 20;
    const width = data.readUInt16LE(o + 6) & 0x3fff;
    const height = data.readUInt16LE(o + 8) & 0x3fff;
    return { width, height };
}

test('forest background is a native WebP plus a portrait crop of the same art', () => {
    const desktop = fs.readFileSync(path.join(root, 'assets/bg/forest-bg-desktop.webp'));
    const mobile = fs.readFileSync(path.join(root, 'assets/bg/forest-bg-mobile.webp'));
    const desktopSize = webpSize(desktop);
    const mobileSize = webpSize(mobile);
    assert.deepStrictEqual(desktopSize, { width: 2544, height: 1904 });
    assert.deepStrictEqual(mobileSize, { width: 880, height: 1904 });
    assert.ok(desktop.length < 8404406);
    assert.ok(mobile.length < desktop.length);
    assert.strictEqual(fs.existsSync(path.join(root, 'assets/bg/village-bg-desktop.webp')), false);
    assert.strictEqual(fs.existsSync(path.join(root, 'assets/bg/village-bg-mobile.webp')), false);
});

test('glass skin and service worker point at the forest art', () => {
    const css = fs.readFileSync(path.join(root, 'css/glass.css'), 'utf8');
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.match(css, /forest-bg-desktop\.webp/);
    assert.match(css, /forest-bg-mobile\.webp/);
    assert.doesNotMatch(css, /village-bg/);
    assert.match(css, /-webkit-backdrop-filter/);
    assert.match(css, /prefers-reduced-transparency/);
    assert.match(css, /pointer-events:\s*none/);
    assert.doesNotMatch(css, /#BFFF00|#00E676|#00D4FF/i);
    assert.match(sw, /const CACHE_NAME = 'liftlogic-v16'/);
    assert.match(sw, /\.\/css\/glass\.css/);
    assert.match(sw, /\.\/assets\/bg\/forest-bg-desktop\.webp/);
    assert.match(sw, /\.\/assets\/bg\/forest-bg-mobile\.webp/);
    assert.doesNotMatch(sw, /village-bg/);
});

test('progress chart markup is grayscale', () => {
    const sandbox = {
        console,
        localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    for (const rel of ['js/utils/dates.js', 'js/data/exercises.js', 'js/data/exercise-progress.js']) {
        const file = path.join(root, rel);
        vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
    }
    const html = sandbox.LiftLogicProgress.toHtml(sandbox.LiftLogicProgress.buildHistory('Dumbbell Bench Press', {
        userId: 'default',
        storage: {
            getItem(key) {
                if (key !== 'workouts') return null;
                return JSON.stringify([{
                    date: '2024-05-01',
                    exercises: [{ kind: 'Dumbbell Bench Press', sets: [{ weight: 50, reps: 8 }, { weight: 55, reps: 8 }] }]
                }, {
                    date: '2024-06-01',
                    exercises: [{ kind: 'Dumbbell Bench Press', sets: [{ weight: 60, reps: 8 }] }]
                }]);
            }
        }
    }));
    assert.match(html, /60 lb × 8/);
    assert.doesNotMatch(html, /#BFFF00|191,\s*255,\s*0/i);
    assert.match(html, /#FFFFFF/);
});

test('app stylesheets and pages do not ship the lime accent', () => {
    const files = [
        'css/theme.css', 'css/glass.css', 'css/rides.css', 'css/leaderboard.css',
        'index.html', 'tracker.html', 'dashboard.html', 'exercises.html',
        'schedule.html', 'data-explorer.html',
        'js/data/exercise-progress.js', 'js/data/backup.js'
    ];
    files.forEach(rel => {
        const text = fs.readFileSync(path.join(root, rel), 'utf8');
        assert.doesNotMatch(text, /#BFFF00|#9ACC00|#00E676/i, rel);
    });
    ['index.html', 'tracker.html', 'dashboard.html', 'exercises.html', 'schedule.html', 'data-explorer.html']
        .forEach(rel => {
            assert.match(fs.readFileSync(path.join(root, rel), 'utf8'), /css\/glass\.css/, rel);
        });
});

test('leaderboard card is not an opaque grey slab and glass removes its gradients', () => {
    const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
    const glass = fs.readFileSync(path.join(root, 'css/glass.css'), 'utf8');
    const section = dashboard.slice(dashboard.indexOf('Leaderboard Section'), dashboard.indexOf('Progressive Overload Tracker'));
    assert.match(section, /id="leaderboard-container"/);
    assert.doesNotMatch(section, /grey-900|linear-gradient/);
    assert.match(glass, /html body \.my-stats-card/);
    assert.match(glass, /html body \.leaderboard,/);
    assert.match(glass, /html body \.auth-bar,/);
    assert.match(glass, /html body \.progress-card/);
});
