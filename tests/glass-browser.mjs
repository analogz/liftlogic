/**
 * Isolated screenshots of the glass skin with synthetic workouts.
 * No Firebase sign-in and no writes outside this Chrome profile.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = '/opt/cursor/artifacts';
const hasChrome = spawnSync('google-chrome', ['--version'], { encoding: 'utf8' }).status === 0;
const serverPort = 22000 + (process.pid % 7000);
const chromePort = 32000 + (process.pid % 7000);

function iso(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const workouts = [2, 6, 9, 13, 16, 20, 24].map((days, i) => ({
    id: `example-${i}`,
    date: iso(days),
    time: '18:00',
    sleepQuality: 6 + (i % 4),
    stressLevel: 3 + (i % 3),
    muscleSoreness: 2 + (i % 4),
    bodyWeight: 180 + i * 0.2,
    exercises: [
        { kind: 'Dumbbell Bench Press', sets: [{ weight: 50 + i * 2.5, reps: 8 }, { weight: 50 + i * 2.5, reps: 7 }] },
        { kind: 'Incline Dumbbell Press', sets: [{ weight: 40 + i * 2, reps: 10 }] },
        { kind: 'Dumbbell Row', sets: [{ weight: 45 + i * 2, reps: 10 }, { weight: 45 + i * 2, reps: 8 }] },
        { kind: 'Dumbbell Shoulder Press', sets: [{ weight: 30 + i, reps: 8 }] },
        { kind: 'Dumbbell Curl', sets: [{ weight: 20 + i, reps: 12 }] }
    ]
}));

test('glass skin screenshots with synthetic history', {
    timeout: 120000,
    skip: hasChrome ? false : 'google-chrome is not installed'
}, async () => {
    await mkdir(artifacts, { recursive: true });
    const userData = await mkdtemp(path.join(tmpdir(), 'll-glass-'));
    const server = spawn('python3', ['-m', 'http.server', String(serverPort), '--bind', '127.0.0.1'], {
        cwd: root, stdio: 'ignore'
    });
    const chrome = spawn('google-chrome', [
        '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
        `--user-data-dir=${userData}`, `--remote-debugging-port=${chromePort}`, '--window-size=1280,900',
        '--host-resolver-rules=MAP firestore.googleapis.com ~NOTFOUND, MAP identitytoolkit.googleapis.com ~NOTFOUND, MAP securetoken.googleapis.com ~NOTFOUND, MAP firebaseinstallations.googleapis.com ~NOTFOUND',
        'about:blank'
    ], { stdio: 'ignore' });
    let ws;
    try {
        await waitForHttp(`http://127.0.0.1:${serverPort}/dashboard.html`);
        const version = await waitForJson(`http://127.0.0.1:${chromePort}/json/version`);
        ws = new WebSocket(version.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            ws.addEventListener('open', resolve, { once: true });
            ws.addEventListener('error', reject, { once: true });
        });
        const session = await connectPage(ws);
        const origin = `http://127.0.0.1:${serverPort}`;

        await session.navigate(`${origin}/dashboard.html`);
        await session.waitFor(`document.body`);
        await session.eval(`localStorage.setItem('workouts', ${JSON.stringify(JSON.stringify(workouts))}); localStorage.setItem('currentUser','default'); true`);
        await session.reload();
        await session.waitFor(`document.querySelector('canvas')`);
        const skin = await session.eval(`(() => {
            const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase();
            const wall = getComputedStyle(document.body, '::before').backgroundImage;
            const brand = getComputedStyle(document.querySelector('.nav-brand')).color;
            return { accent, wall, brand, lime: document.documentElement.outerHTML.includes('#BFFF00') };
        })()`);
        expect(!/bfff00|00e676/.test(skin.accent), `accent is ${skin.accent}`);
        expect(skin.wall.includes('forest-bg'), `wallpaper missing: ${skin.wall}`);
        expect(skin.lime === false, 'lime hex still in the dashboard document');
        const overflow = await measureOverflow(session, 1280, 900, false);
        expect(overflow <= 1, `dashboard desktop overflow ${overflow}`);
        await auditContrast(session, 'dashboard');
        await shotTop(session, 'glass-dashboard-desktop.png', 1280, 1280, false);
        await shotDetail(session, 'glass-detail-dashboard.png', '.stat-card');
        await assertLeaderboardMaterial(session, 'signed-out');
        await shotDetail(session, 'glass-detail-leaderboard.png', '.card:has(#leaderboard-container)', 640);
        await renderLeaderboardState(session, 'empty');
        await assertLeaderboardMaterial(session, 'empty');
        await shotDetail(session, 'glass-detail-leaderboard-empty.png', '.card:has(#leaderboard-container)', 720);
        await renderLeaderboardState(session, 'populated');
        await assertLeaderboardMaterial(session, 'populated');
        await shotDetail(session, 'glass-detail-leaderboard-populated.png', '.card:has(#leaderboard-container)', 760);
        await renderLeaderboardState(session, 'out');
        await session.eval(`window.scrollTo(0, 0)`);
        await session.viewport(1280, 900, false);
        const chartBox = await session.eval(`(() => {
            const el = document.getElementById('weeklyVolumeChart');
            if (!el) return null;
            el.scrollIntoView({ block: 'center' });
            const r = el.getBoundingClientRect();
            const wrap = el.closest('.chart-wrapper') || el.parentElement;
            const w = wrap.getBoundingClientRect();
            return {
                rw: r.width, rh: r.height,
                x: Math.max(0, w.left + window.scrollX - 16),
                y: Math.max(0, w.top + window.scrollY - 48),
                width: Math.ceil(w.width + 32),
                height: Math.ceil(w.height + 64)
            };
        })()`);
        expect(chartBox && chartBox.rh > 40, `weekly volume chart missing ${JSON.stringify(chartBox)}`);
        await assertSingleLayer(session, 'dashboard');
        const chartPng = await session.screenshot(chartBox, true);
        await writeFile(path.join(artifacts, 'glass-dashboard-chart-desktop.png'), chartPng);
        const mobileOverflow = await measureOverflow(session, 390, 844, true);
        expect(mobileOverflow <= 1, `dashboard mobile overflow ${mobileOverflow}`);
        await session.eval(`window.scrollTo(0, 0)`);
        await shotTop(session, 'glass-dashboard-mobile.png', 390, 1100, true);
        await shotDetail(session, 'glass-detail-leaderboard-mobile.png', '.card:has(#leaderboard-container)', 780);

        await session.navigate(`${origin}/tracker.html`);
        await session.waitFor(`document.getElementById('exercise-1')`);
        await assertSingleLayer(session, 'tracker-empty');
        await session.viewport(1100, 1000, false);
        await shotDetail(session, 'glass-tracker-empty-desktop.png', '.card:has(#exercises-container)', 900);
        await session.viewport(390, 900, true);
        await shotDetail(session, 'glass-tracker-empty-mobile.png', '.card:has(#exercises-container)', 1100);
        await session.eval(`(() => {
            const input = document.getElementById('exercise-1');
            input.value = 'Dumbbell Bench Press';
            showProgressiveOverloadHint(1);
            return true;
        })()`);
        await session.waitFor(`document.querySelector('.progress-svg')`);
        const tracker = await session.eval(`(() => {
            const text = document.getElementById('progress-1').textContent;
            const svg = document.querySelector('.progress-svg').outerHTML;
            return { text, lime: svg.includes('#BFFF00') || svg.includes('191,255,0') };
        })()`);
        expect(tracker.text.includes('lb ×'), tracker.text.slice(0, 160));
        expect(tracker.lime === false, 'progress chart still uses lime');
        await assertSingleLayer(session, 'tracker-populated');
        await assertQuietEdges(session);
        await shotTall(session, 'glass-tracker-desktop.png', 1100, false);
        await shotDetail(session, 'glass-detail-tracker.png', '.exercise-entry', 720);
        await shotDetail(session, 'glass-detail-progress.png', '.progress-card', 640);
        await shotTall(session, 'glass-tracker-mobile.png', 390, true);
        const restVisible = await session.eval(`(() => {
            const timer = document.querySelector('.rest-timer');
            const nav = document.querySelector('.bottom-nav');
            const tr = timer.getBoundingClientRect();
            const nr = nav ? nav.getBoundingClientRect() : null;
            const style = getComputedStyle(timer.querySelector('.rest-time'));
            return {
                timerTop: tr.top,
                timerBottom: tr.bottom,
                navTop: nr ? nr.top : null,
                covered: nr ? tr.bottom > nr.top + 2 && tr.top < nr.bottom : false,
                color: style.color
            };
        })()`);
        expect(restVisible.covered === false, `rest timer sits under the bottom nav ${JSON.stringify(restVisible)}`);
        expect(!/rgb\(107,\s*107,\s*107\)/.test(restVisible.color), `rest time contrast ${restVisible.color}`);
        await auditContrast(session, 'tracker');

        await session.navigate(`${origin}/index.html`);
        await session.waitFor(`document.querySelector('.brand')`);
        await shotTop(session, 'glass-home-desktop.png', 1100, 1000, false);
    } finally {
        if (ws && ws.readyState === WebSocket.OPEN) ws.close();
        chrome.kill('SIGKILL');
        server.kill('SIGKILL');
        await delay(300);
        await rm(userData, { recursive: true, force: true }).catch(() => {});
    }
});

function expect(cond, message) {
    if (!cond) throw new Error(message);
}

async function renderLeaderboardState(session, mode) {
    const user = mode === 'out' ? null : {
        uid: 'synthetic-user',
        displayName: 'Alex Rivera',
        photoURL: ''
    };
    const board = mode === 'populated' ? [
        { rank: 1, odId: 'other', displayName: 'Jordan Lee', photoURL: '', totalSets: 18, daysTraining: 3, score: 8420 },
        { rank: 2, odId: 'synthetic-user', displayName: 'Alex Rivera', photoURL: '', totalSets: 14, daysTraining: 2, score: 6100 },
        { rank: 3, odId: 'third', displayName: 'Sam Patel', photoURL: '', totalSets: 9, daysTraining: 2, score: 3900 }
    ] : [];
    await session.eval(`(() => {
        const user = ${JSON.stringify(user)};
        const board = ${JSON.stringify(board)};
        LiftLogicAuth.getCurrentUser = () => user;
        LiftLogicAuth.subscribe = (cb) => { cb(user ? 'signedIn' : 'signedOut', user); return () => {}; };
        LiftLogicLeaderboard.getLeaderboard = () => board;
        LiftLogicLeaderboard.getMyRank = () => ${mode === 'populated' ? '2' : 'null'};
        LiftLogicLeaderboard.subscribe = (cb) => { cb('updated', board); return () => {}; };
        LeaderboardUI.render('leaderboard-container');
        return true;
    })()`);
}

async function assertLeaderboardMaterial(session, mode) {
    const report = await session.eval(`(() => {
        const read = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const style = getComputedStyle(el);
            return { image: style.backgroundImage, color: style.backgroundColor };
        };
        const card = document.querySelector('.card:has(#leaderboard-container)');
        const cardStyle = card ? getComputedStyle(card) : null;
        return {
            auth: read('.auth-bar'),
            board: read('.leaderboard'),
            stats: read('.my-stats-card'),
            card: cardStyle ? { image: cardStyle.backgroundImage, color: cardStyle.backgroundColor } : null,
            google: !!document.querySelector('#google-signin-btn svg path[fill="#4285F4"]'),
            signOut: !!document.getElementById('signout-btn'),
            empty: (document.querySelector('.leaderboard-empty-text') || {}).textContent || '',
            names: [...document.querySelectorAll('.leaderboard-name')].map(node => node.textContent)
        };
    })()`);
    for (const [name, item] of [['auth', report.auth], ['board', report.board], ['stats', report.stats]]) {
        if (!item) continue;
        expect(!/gradient/i.test(item.image), `${mode} ${name} gradient ${item.image}`);
    }
    expect(report.card && /rgba?\(18,\s*22,\s*26/.test(report.card.color), `${mode} leaderboard card ${JSON.stringify(report.card)}`);
    const boardAlpha = Number((report.board.color.match(/([\d.]+)\s*\)\s*$/) || [])[1] || 1);
    expect(boardAlpha < 0.25, `${mode} nested leaderboard fill ${report.board.color}`);
    if (mode === 'signed-out') {
        expect(report.google, 'Google mark missing from the signed-out panel');
        expect(/sign in to view/i.test(report.empty), report.empty);
    }
    if (mode === 'empty') {
        expect(report.signOut, 'signed-in empty state missing sign out');
        expect(/no entries/i.test(report.empty), report.empty);
        expect(report.stats && !/gradient/i.test(report.stats.image), JSON.stringify(report.stats));
    }
    if (mode === 'populated') {
        expect(report.names.some(name => name.includes('Alex Rivera')), JSON.stringify(report.names));
        expect(report.stats && !/gradient/i.test(report.stats.image), JSON.stringify(report.stats));
    }
}

async function assertSingleLayer(session, label) {
    const report = await session.eval(`(() => {
        const read = (el) => {
            if (!el) return null;
            const style = getComputedStyle(el);
            return {
                filter: style.backdropFilter || 'none',
                bg: style.backgroundColor,
                shadow: style.boxShadow
            };
        };
        const exercises = document.querySelector('#exercises-container');
        return {
            exercises: read(exercises && exercises.closest('.card')),
            entry: read(document.querySelector('.exercise-entry')),
            set: read(document.querySelector('.set-entry')),
            rest: read(document.querySelector('.rest-timer')),
            hint: read(document.querySelector('.last-workout-hint')),
            progress: read(document.querySelector('.progress-card')),
            chart: read(document.querySelector('.chart-wrapper')),
            stat: read(document.querySelector('.stats-grid > .stat-card')),
            nestedStat: read(document.querySelector('.card .stat-card')),
            scorecard: read(document.querySelector('.volume-scorecard'))
        };
    })()`);
    const frosted = (node) => node && /blur/.test(node.filter || '');
    const clear = (node, name) => {
        if (!node) return;
        expect(!frosted(node), `${label} ${name} still frosts ${node.filter}`);
        expect(/rgba?\(0,\s*0,\s*0,\s*0\)/.test(node.bg), `${label} ${name} fill ${node.bg}`);
        expect(node.shadow === 'none' || /0px 0px 0px 0px/.test(node.shadow), `${label} ${name} shadow ${node.shadow}`);
    };
    if (label.startsWith('tracker')) {
        expect(frosted(report.exercises), `${label} exercises section lost its glass ${JSON.stringify(report.exercises)}`);
        clear(report.entry, 'exercise card');
        clear(report.set, 'set row');
        clear(report.rest, 'rest timer');
        clear(report.hint, 'hint');
        clear(report.progress, 'progress');
    }
    if (label === 'dashboard') {
        expect(frosted(report.scorecard) || frosted(report.stat), `${label} top section lost its glass`);
        clear(report.nestedStat, 'nested stat');
        expect(report.chart && !frosted(report.chart), `${label} chart still frosts ${report.chart && report.chart.filter}`);
    }
}

async function assertQuietEdges(session) {
    const rows = await session.eval(`(() => {
        return ['.progress-card', '.last-workout-hint', '.exercise-name', '.btn-danger', '.set-entry input', '.progress-readout'].map(sel => {
            const el = document.querySelector(sel);
            if (!el) return { sel, missing: true };
            const style = getComputedStyle(el);
            return { sel, border: style.borderTopColor, bg: style.backgroundColor };
        });
    })()`);
    for (const row of rows) {
        expect(!row.missing, `missing ${row.sel}`);
        expect(!/rgb\(2[2-5]\d,\s*2[2-5]\d,\s*2[2-5]\d\)/.test(row.border), `${row.sel} bright border ${row.border}`);
        expect(!/rgba\(255,\s*255,\s*255,\s*0\.[3-9]/.test(row.border), `${row.sel} bright border ${row.border}`);
    }
    const readout = rows.find(row => row.sel === '.progress-readout');
    expect(!/rgba?\(0,\s*0,\s*0,\s*1\)|rgba?\(13,\s*13,\s*13/.test(readout.bg), `readout slab ${readout.bg}`);
}

async function auditContrast(session, label) {
    const report = await session.eval(`(async () => {
        function rel(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
        function lum(rgb) { return 0.2126 * rel(rgb[0]) + 0.7152 * rel(rgb[1]) + 0.0722 * rel(rgb[2]); }
        function parse(c) {
            const m = String(c).match(/rgba?\\(([^)]+)\\)/);
            if (!m) return null;
            const p = m[1].split(',').map(Number);
            return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
        }
        function composite(fg, bg) {
            const a = fg.a;
            return [0, 1, 2].map(i => fg.rgb[i] * a + bg[i] * (1 - a));
        }
        function contrast(a, b) {
            const hi = Math.max(lum(a), lum(b));
            const lo = Math.min(lum(a), lum(b));
            return (hi + 0.05) / (lo + 0.05);
        }
        function worstContrast(el) {
            const color = parse(getComputedStyle(el).color);
            const layers = [];
            let node = el;
            while (node && node !== document.body && node !== document.documentElement) {
                const bg = parse(getComputedStyle(node).backgroundColor);
                if (bg && bg.a > 0.01) layers.push(bg);
                if (bg && bg.a >= 0.98) break;
                node = node.parentElement;
            }
            // Sampled from the supplied forest, not a flat page wash.
            // Open type (no panel) is judged on trunk and median woods, where titles sit.
            // Type on a panel is also judged on a bright fern mass.
            const forests = layers.length
                ? [[30, 36, 28], [106, 141, 77], [154, 168, 90]]
                : [[30, 36, 28], [47, 63, 35]];
            const ratios = forests.map(forest => {
                let acc = forest;
                for (let i = layers.length - 1; i >= 0; i--) acc = composite(layers[i], acc);
                return contrast(color.rgb, acc);
            });
            return Math.min(...ratios);
        }
        const selectors = ['h1', 'h2', '.stat-label', '.nav-link', '.filter-group label', '.filter-group select', '.volume-scorecard h2', '.legend-item', '.caption', '#sleepQuality', '.day-selector', '.rest-time', '.btn-timer', '.radio-label', '.set-label', '.exercise-name', '.bottom-nav-item', '.hint-value', '.progress-note', '.progress-metric'];
        const rows = [];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (!el) continue;
            const style = getComputedStyle(el);
            const bg = parse(style.backgroundColor);
            rows.push({
                sel,
                color: style.color,
                background: style.backgroundColor,
                worst: Math.round(worstContrast(el) * 100) / 100,
                translucent: !bg || bg.a < 0.55
            });
        }
        const field = document.querySelector('#sleepQuality, .day-selector, .filter-group select');
        let focus = null;
        if (field) {
            field.focus();
            await new Promise(resolve => setTimeout(resolve, 280));
            const style = getComputedStyle(field);
            const matched = [];
            for (const sheet of document.styleSheets) {
                let rules;
                try { rules = [...sheet.cssRules]; } catch (err) { continue; }
                for (const rule of rules) {
                    if (!rule.selectorText || !rule.selectorText.includes(':focus')) continue;
                    let ok = false;
                    try { ok = field.matches(rule.selectorText); } catch (err) { ok = false; }
                    if (ok) matched.push(rule.selectorText.slice(0, 180));
                }
            }
            focus = {
                active: document.activeElement && document.activeElement.id,
                outline: style.outlineStyle + ' ' + style.outlineColor,
                border: style.borderColor,
                shadow: style.boxShadow,
                matched
            };
            field.blur();
        }
        const probe = document.createElement('button');
        probe.disabled = true;
        document.body.appendChild(probe);
        const disabled = Number(getComputedStyle(probe).opacity);
        probe.remove();
        const checked = document.querySelector('.radio-label:has(input:checked)');
        const selected = checked ? { color: getComputedStyle(checked).color, background: getComputedStyle(checked).backgroundColor, worst: Math.round(worstContrast(checked) * 100) / 100 } : null;
        return { rows, focus, disabled, selected };
    })()`);
    console.log(`CONTRAST ${label} ${JSON.stringify(report)}`);
    const dim = report.rows.filter(row => row.worst < 4.5);
    expect(dim.length === 0, `${label} contrast under 4.5 ${JSON.stringify(dim)}`);
    const fields = report.rows.filter(row => ['.filter-group select', '#sleepQuality', '.day-selector'].includes(row.sel));
    for (const field of fields) {
        expect(field.translucent, `${label} ${field.sel} is an opaque slab (${field.background})`);
    }
    if (report.disabled != null) expect(report.disabled <= 0.7 && report.disabled >= 0.4, `${label} disabled opacity ${report.disabled}`);
    if (report.focus) expect(/rgb\(245,\s*245,\s*245\)|rgb\(255,\s*255,\s*255\)/.test(`${report.focus.border} ${report.focus.outline}`), `${label} focus ring ${JSON.stringify(report.focus)}`);
    if (report.selected) expect(report.selected.worst >= 4.5, `${label} selected radio ${JSON.stringify(report.selected)}`);
}

async function measureOverflow(session, width, height, mobile) {
    await session.viewport(width, height, mobile);
    return session.eval(`document.documentElement.scrollWidth - window.innerWidth`);
}

async function placeBadge(session) {
    const placed = await session.eval(`(() => {
        document.querySelectorAll('.example-banner').forEach(node => node.remove());
        const bar = document.createElement('div');
        bar.className = 'example-banner';
        bar.textContent = 'EXAMPLE DATA';
        bar.style.cssText = 'position:fixed;z-index:3000;pointer-events:none;background:rgba(12,12,12,0.82);color:#F4F4F4;font:700 9px/1.15 Outfit,sans-serif;letter-spacing:.04em;text-transform:uppercase;padding:4px 6px;border-radius:7px;text-align:center;width:68px;';
        document.body.appendChild(bar);
        window.scrollTo(0, 0);
        const w = bar.offsetWidth;
        const h = bar.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const avoid = [...document.querySelectorAll('a, button, h1, h2, label, .page-title, .brand, .nav-brand, .bottom-nav, .bottom-nav-item, .mode-toggle, input, select, textarea, .rest-timer, .landing')]
            .filter(el => el.getClientRects().length)
            .map(el => el.getBoundingClientRect());
        const hits = (x, y) => avoid.some(r => x < r.right + 2 && x + w > r.left - 2 && y < r.bottom + 2 && y + h > r.top - 2);
        const brand = document.querySelector('.nav-brand, .brand');
        const firstLink = [...document.querySelectorAll('.nav-links a, .nav-links button')].find(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
        });
        const candidates = [];
        if (brand && firstLink) {
            const b = brand.getBoundingClientRect();
            const l = firstLink.getBoundingClientRect();
            const gap = l.left - b.right;
            if (gap > w + 8) candidates.push([b.right + (gap - w) / 2, Math.max(6, b.top + (b.height - h) / 2)]);
        }
        for (let y = 8; y < vh - h - 8; y += 36) {
            candidates.push([8, y], [vw - w - 8, y]);
        }
        const pos = candidates.find(([x, y]) => x >= 4 && y >= 4 && x + w < vw - 2 && !hits(x, y));
        const chosen = pos || candidates[0] || [8, 8];
        bar.style.left = chosen[0] + 'px';
        bar.style.top = chosen[1] + 'px';
        const badge = bar.getBoundingClientRect();
        const blocked = [...document.querySelectorAll('.nav-link, .nav-brand, h1, .page-title, .bottom-nav-item, .rest-timer, .btn-timer, input, select, textarea, label, button')]
            .filter(el => el.getClientRects().length)
            .filter(el => {
                const r = el.getBoundingClientRect();
                return badge.left < r.right && badge.right > r.left && badge.top < r.bottom && badge.bottom > r.top;
            })
            .map(el => (el.innerText || el.className || el.tagName).trim().slice(0, 40));
        return { blocked, top: badge.top, left: badge.left };
    })()`);
    if (placed.blocked.length) {
        throw new Error(`example badge covers ${placed.blocked.join(', ')}`);
    }
}

async function shotTop(session, filename, width, height, mobile) {
    await session.viewport(width, height, mobile);
    await placeBadge(session);
    const png = await session.screenshot({ x: 0, y: 0, width, height }, false);
    await writeFile(path.join(artifacts, filename), png);
}

async function shotDetail(session, filename, selector, maxHeight = 460) {
    const box = await session.eval(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const pad = 18;
        return {
            x: Math.max(0, r.left + window.scrollX - pad),
            y: Math.max(0, r.top + window.scrollY - pad),
            width: Math.min(1500, Math.ceil(r.width + pad * 2)),
            height: Math.min(${maxHeight}, Math.ceil(Math.max(80, r.height) + pad * 2))
        };
    })()`);
    expect(box && box.width > 40 && box.height > 40, `detail crop missing ${selector} ${JSON.stringify(box)}`);
    const png = await session.screenshot(box, true);
    await writeFile(path.join(artifacts, filename), png);
}

async function shotTall(session, filename, width, mobile) {
    await session.viewport(width, 900, mobile);
    const height = await session.eval(`Math.min(2800, Math.max(1000, document.documentElement.scrollHeight))`);
    await session.viewport(width, height, mobile);
    await session.eval(`window.scrollTo(0, 0)`);
    await placeBadge(session);
    const png = await session.screenshot({ x: 0, y: 0, width, height }, false);
    await writeFile(path.join(artifacts, filename), png);
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function httpGet(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
        });
        req.on('error', reject);
        req.setTimeout(2000, () => req.destroy(new Error('timeout')));
    });
}

async function waitForHttp(url) {
    for (let i = 0; i < 50; i++) {
        try { if ((await httpGet(url)).status === 200) return; } catch { /* starting */ }
        await delay(100);
    }
    throw new Error(`server did not start for ${url}`);
}

async function waitForJson(url) {
    for (let i = 0; i < 50; i++) {
        try {
            const res = await httpGet(url);
            if (res.status === 200) return JSON.parse(res.body);
        } catch { /* starting */ }
        await delay(100);
    }
    throw new Error(`chrome debug port did not open: ${url}`);
}

function connectPage(ws) {
    let next = 0;
    const pending = new Map();
    const loadWaiters = [];
    ws.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
            const { resolve, reject } = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) reject(new Error(JSON.stringify(message.error)));
            else resolve(message.result);
            return;
        }
        if (message.method === 'Page.loadEventFired') loadWaiters.splice(0).forEach(fn => fn());
    });
    function send(method, params, sessionId) {
        const id = ++next;
        ws.send(JSON.stringify({ id, method, params: params || {}, sessionId }));
        return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    }
    return (async () => {
        const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
        await send('Page.enable', {}, sessionId);
        await send('Runtime.enable', {}, sessionId);
        return {
            async navigate(url) {
                const loaded = new Promise(resolve => loadWaiters.push(resolve));
                await send('Page.navigate', { url }, sessionId);
                await loaded;
            },
            async reload() {
                const loaded = new Promise(resolve => loadWaiters.push(resolve));
                await send('Page.reload', { ignoreCache: true }, sessionId);
                await loaded;
            },
            async eval(expression) {
                const result = await send('Runtime.evaluate', {
                    expression, returnByValue: true, awaitPromise: true
                }, sessionId);
                if (result.exceptionDetails) {
                    throw new Error((result.exceptionDetails.exception && result.exceptionDetails.exception.description) || result.exceptionDetails.text);
                }
                return result.result.value;
            },
            async waitFor(expression) {
                const started = Date.now();
                while (Date.now() - started < 20000) {
                    try { if (await this.eval(`!!(${expression})`)) return; } catch { /* navigating */ }
                    await delay(100);
                }
                throw new Error(`timed out waiting for ${expression}`);
            },
            viewport(width, height, mobile) {
                return send('Emulation.setDeviceMetricsOverride', {
                    width, height, deviceScaleFactor: 1, mobile: !!mobile
                }, sessionId);
            },
            async screenshot(clip, beyond = false) {
                const result = await send('Page.captureScreenshot', {
                    format: 'png',
                    captureBeyondViewport: beyond,
                    clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 2 }
                }, sessionId);
                return Buffer.from(result.data, 'base64');
            }
        };
    })();
}
