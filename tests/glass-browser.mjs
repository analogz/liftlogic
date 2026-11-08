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
        await shot(session, 'glass-dashboard-desktop.png', 1280, 1100, false);
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
        const chartPng = await session.screenshot(chartBox, true);
        await writeFile(path.join(artifacts, 'glass-dashboard-chart-desktop.png'), chartPng);
        const mobileOverflow = await measureOverflow(session, 390, 844, true);
        expect(mobileOverflow <= 1, `dashboard mobile overflow ${mobileOverflow}`);
        await session.eval(`window.scrollTo(0, 0)`);
        await shot(session, 'glass-dashboard-mobile.png', 390, 900, true);

        await session.navigate(`${origin}/tracker.html`);
        await session.waitFor(`document.getElementById('exercise-1')`);
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
        await shotCard(session, 'glass-tracker-desktop.png', 1100, 1600, false);
        await shotCard(session, 'glass-tracker-mobile.png', 390, 1700, true);

        await session.navigate(`${origin}/index.html`);
        await session.waitFor(`document.querySelector('.brand')`);
        await shot(session, 'glass-home-desktop.png', 1100, 900, false, '.landing');
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

async function measureOverflow(session, width, height, mobile) {
    await session.viewport(width, height, mobile);
    return session.eval(`document.documentElement.scrollWidth - window.innerWidth`);
}

async function shot(session, filename, width, height, mobile, selector) {
    await session.viewport(width, height, mobile);
    await session.eval(`(() => {
        document.querySelectorAll('.example-banner').forEach(node => node.remove());
        const bar = document.createElement('div');
        bar.className = 'example-banner';
        bar.textContent = 'EXAMPLE DATA — synthetic fixture, not a real training log';
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2000;background:#111;color:#F4F4F4;font:700 12px/1.35 Outfit,sans-serif;letter-spacing:.04em;text-transform:uppercase;text-align:center;padding:8px 10px;';
        document.body.prepend(bar);
        const target = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : 'document.querySelector("h1")'};
        if (target) target.scrollIntoView({ block: 'start' });
        window.scrollBy(0, -40);
        return true;
    })()`);
    const png = await session.screenshot({ x: 0, y: 0, width, height }, false);
    await writeFile(path.join(artifacts, filename), png);
}

async function shotCard(session, filename, width, height, mobile) {
    await session.viewport(width, Math.max(height, 2200), mobile);
    const box = await session.eval(`(() => {
        document.querySelectorAll('.example-banner').forEach(node => node.remove());
        document.querySelectorAll('nav, .bottom-nav').forEach(node => { node.style.display = 'none'; });
        const entry = document.querySelector('.exercise-entry');
        const bar = document.createElement('div');
        bar.className = 'example-banner';
        bar.textContent = 'EXAMPLE DATA — synthetic fixture, not a real training log';
        bar.style.cssText = 'background:#111;color:#F4F4F4;font:700 12px/1.35 Outfit,sans-serif;letter-spacing:.03em;text-transform:uppercase;text-align:center;padding:8px 10px;border-radius:8px;margin:0 0 12px;';
        entry.parentElement.insertBefore(bar, entry);
        const top = bar.getBoundingClientRect();
        const card = entry.getBoundingClientRect();
        const y = Math.min(top.y, card.y);
        const bottom = Math.max(top.bottom, card.bottom);
        const pad = 10;
        return {
            x: Math.max(0, card.x + window.scrollX - pad),
            y: Math.max(0, y + window.scrollY - pad),
            width: Math.ceil(card.width + pad * 2),
            height: Math.ceil(bottom - y + pad * 2)
        };
    })()`);
    const png = await session.screenshot(box, true);
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
