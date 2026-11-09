/**
 * The glass skin is the LiftLogic Placard pass: white frost, black ink, one
 * typeface. The bundled forest art is the original WebP bytes (not a re-encode).
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
    assert.match(sw, /const CACHE_NAME = 'liftlogic-v23'/);
    assert.match(sw, /\.\/css\/glass\.css/);
    assert.match(sw, /\.\/assets\/bg\/forest-bg-desktop\.webp/);
    assert.match(sw, /\.\/assets\/bg\/forest-bg-mobile\.webp/);
    assert.doesNotMatch(sw, /village-bg/);
});

test('progress chart markup is ink on the glass at a fixed pixel scale', () => {
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
    assert.match(html, /<polyline[^>]*stroke="#000" stroke-width="1\.5"/);
    assert.match(html, /<line[^>]*stroke="rgba\(0,0,0,0\.08\)"/);
    assert.match(html, /viewBox="0 0 320 180"/);
    assert.doesNotMatch(html, /#F4F4F4|#C8C8C8|#E8E8E8|ui-monospace|<polygon/);
});

test('chart wells are transparent and plot ink is black', () => {
    const glass = fs.readFileSync(path.join(root, 'css/glass.css'), 'utf8');
    const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
    assert.match(glass, /html body \.chart-wrapper,\s*html body \.chart-wrapper canvas/);
    assert.match(glass, /\.chart-wrapper canvas,[\s\S]*?background:\s*transparent/);
    assert.match(dashboard, /d\.elements\.line\.borderColor = '#000'/);
    assert.match(dashboard, /d\.elements\.line\.borderWidth = 1\.5/);
    assert.match(dashboard, /d\.plugins\.tooltip\.backgroundColor = '#000'/);
    assert.doesNotMatch(dashboard, /borderColor:\s*'#F4F4F4'|backgroundColor:\s*'#E8E8E8'|color:\s*'#E4E4E4'|grid:\s*\{\s*color:\s*'rgba\(255/);
    assert.doesNotMatch(dashboard, /borderDash|tension:\s*0\.[34]/);
    assert.doesNotMatch(dashboard, /fill:\s*true/);
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

test('glass panes carry one inset hairline edge, no rim and no drop shadow', () => {
    const glass = fs.readFileSync(path.join(root, 'css/glass.css'), 'utf8');
    assert.match(glass, /--edge-glass:\s*inset 0 0 0 1px var\(--glass-edge\)/);
    assert.match(glass, /box-shadow:\s*var\(--edge-glass\)/);
    assert.doesNotMatch(glass, /--glass-rim|mask-composite|0 18px 40px|0 24px 56px/);
    assert.match(glass, /--shadow-sm:\s*none/);
    assert.match(glass, /--shadow-lg:\s*none/);
});

test('placard pass uses the white frost recipe and one typeface', () => {
    const glass = fs.readFileSync(path.join(root, 'css/glass.css'), 'utf8');
    assert.match(glass, /--glass-fill:\s*rgba\(255,\s*255,\s*255,\s*0\.62\)/);
    assert.match(glass, /--glass-blur:\s*24px/);
    assert.match(glass, /--glass-sat:\s*1\.3/);
    assert.match(glass, /forest-bg-desktop\.webp/);
    assert.doesNotMatch(glass, /--glass-dark|--glass-overlay|--glass-modal|radial-gradient/);
    assert.match(glass, /--font-sans:\s*"Instrument Sans"/);
    assert.match(glass, /--font-mono:\s*var\(--font-sans\)/);
    assert.match(glass, /html body nav:not\(\.bottom-nav\)::before/);
    assert.match(glass, /html body nav\.is-scrolled:not\(\.bottom-nav\)::after \{ opacity: 1; \}/);
    assert.match(glass, /font-variant-numeric:\s*tabular-nums/);
    assert.match(glass, /prefers-reduced-motion:\s*reduce/);
    assert.match(glass, /html body \.bottom-nav-icon[\s\S]*?font-size:\s*0/);
    assert.match(glass, /stroke-width='1\.5'/);
    assert.match(glass, /data-nav="workout"/);
    assert.doesNotMatch(glass, /corner-shape:\s*superellipse/);
});

test('every page loads Instrument Sans, wraps its content in a pane and syncs the title bar', () => {
    const pages = ['index.html', 'tracker.html', 'dashboard.html', 'exercises.html', 'schedule.html', 'data-explorer.html'];
    pages.forEach(rel => {
        const html = fs.readFileSync(path.join(root, rel), 'utf8');
        assert.match(html, /fonts\.googleapis\.com\/css2\?family=Instrument\+Sans:wght@400\.\.700/, rel);
        assert.doesNotMatch(html, /family=Outfit|family=JetBrains\+Mono/, rel);
        assert.match(html, /<section class="pane[ "]/, rel);
        assert.match(html, /classList\.toggle\('is-scrolled', window\.scrollY > 8\)/, rel);
        assert.ok(html.lastIndexOf('css/glass.css') > html.lastIndexOf('</style>'), `${rel}: glass.css must load after the page's own styles`);
    });
    const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
    assert.match(dashboard, /<section class="pane pane--summary">/);
    assert.match(dashboard, /<section class="pane pane--trends">/);
});

test('every page shares one title bar, one tab bar and the monoline icon set', () => {
    const pages = ['index.html', 'tracker.html', 'dashboard.html', 'exercises.html', 'schedule.html', 'data-explorer.html'];
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    const topItems = (html) => {
        const nav = html.match(/^    <nav>\n[\s\S]*?\n    <\/nav>/m);
        assert.ok(nav, 'title bar missing');
        return [...nav[0].matchAll(/data-nav="([^"]+)"/g)].map(m => m[1]).join(',');
    };
    const tabItems = (html) => [...html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)[0].matchAll(/data-nav="([^"]+)"/g)].map(m => m[1]).join(',');
    pages.forEach(rel => {
        const html = fs.readFileSync(path.join(root, rel), 'utf8');
        assert.strictEqual(topItems(html), 'workout,ride,schedule,exercises,stats,data', rel);
        assert.strictEqual(tabItems(html), 'workout,ride,exercises,stats,home', rel);
        const body = html.replace(/<span class="bottom-nav-icon"[^<]*<\/span>/g, '');
        assert.doesNotMatch(body, emoji, `${rel} still ships an emoji`);
        assert.match(html, /rect width=%2264%22 height=%2264%22 rx=%2216%22/, `${rel} favicon`);
    });
    const glass = fs.readFileSync(path.join(root, 'css/glass.css'), 'utf8');
    ['workout', 'ride', 'exercises', 'stats', 'home', 'schedule', 'data', 'cloud', 'trophy', 'lock', 'close'].forEach(name => {
        assert.match(glass, new RegExp(`--icon-${name}: url\\("data:image/svg\\+xml,<svg[^"]*stroke-width='1\\.5'`), name);
        assert.match(glass, new RegExp(`\\.icon\\[data-icon="${name}"\\]`), name);
    });
    assert.match(glass, /html body \.bottom-nav \[data-nav="workout"\] \{ --nav-icon: var\(--icon-workout\); \}/);
    for (const rel of ['js/firebase/leaderboard-ui.js', 'js/ride-log.js', 'js/data/backup.js', 'js/schedule-data.js']) {
        assert.doesNotMatch(fs.readFileSync(path.join(root, rel), 'utf8'), emoji, rel);
    }
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
