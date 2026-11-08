/**
 * Isolated check that the default schedule loads dumbbell exercises
 * and does not rewrite a saved barbell log.
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
const serverPort = 21000 + (process.pid % 8000);
const chromePort = 31000 + (process.pid % 8000);

const savedWorkouts = [{
    id: 'barbell-history',
    date: '2024-08-01',
    exercises: [
        { kind: 'Barbell Bench Press', sets: [{ weight: 185, reps: 5 }] },
        { kind: 'Incline Barbell Press', sets: [{ weight: 135, reps: 6 }] }
    ]
}];
const customSchedule = { title: 'Nick custom week', days: ['Barbell Bench Press'] };

test('default schedule loads dumbbells and leaves saved logs alone', {
    timeout: 120000,
    skip: hasChrome ? false : 'google-chrome is not installed'
}, async () => {
    await mkdir(artifacts, { recursive: true });
    const userData = await mkdtemp(path.join(tmpdir(), 'll-sched-'));
    const server = spawn('python3', ['-m', 'http.server', String(serverPort), '--bind', '127.0.0.1'], {
        cwd: root,
        stdio: 'ignore'
    });
    const chrome = spawn('google-chrome', [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--hide-scrollbars',
        `--user-data-dir=${userData}`,
        `--remote-debugging-port=${chromePort}`,
        '--window-size=1280,1600',
        '--host-resolver-rules=MAP firestore.googleapis.com ~NOTFOUND, MAP identitytoolkit.googleapis.com ~NOTFOUND, MAP securetoken.googleapis.com ~NOTFOUND, MAP firebaseinstallations.googleapis.com ~NOTFOUND',
        'about:blank'
    ], { stdio: 'ignore' });

    let ws;
    try {
        await waitForHttp(`http://127.0.0.1:${serverPort}/schedule.html`);
        const version = await waitForJson(`http://127.0.0.1:${chromePort}/json/version`);
        ws = new WebSocket(version.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            ws.addEventListener('open', resolve, { once: true });
            ws.addEventListener('error', reject, { once: true });
        });
        const session = await connectPage(ws);
        const origin = `http://127.0.0.1:${serverPort}`;

        await session.navigate(`${origin}/schedule.html`);
        await session.waitFor(`document.getElementById('scheduleDaysContainer') && document.getElementById('scheduleDaysContainer').textContent.includes('Monday')`);
        await seed(session);
        await session.reload();
        await session.waitFor(`document.getElementById('scheduleTitle') && document.getElementById('scheduleTitle').textContent.includes('5-Day')`);

        const scheduleText = await session.eval(`document.getElementById('scheduleDaysContainer').textContent`);
        expect(scheduleText.includes('Dumbbell Bench Press'), 'Monday lists the flat dumbbell press');
        expect(scheduleText.includes('Dumbbell Row'), 'Tuesday lists the dumbbell row');
        expect(scheduleText.includes('Dumbbell Curl'), 'Tuesday lists the dumbbell curl');
        expect(scheduleText.includes('Dumbbell Shoulder Press'), 'Wednesday lists the dumbbell press');
        expect(scheduleText.includes('Incline Dumbbell Press'), 'Friday lists the incline dumbbell press');
        expect(!/barbell/i.test(scheduleText), `schedule still mentions a barbell: ${scheduleText.slice(0, 200)}`);
        expect(scheduleText.includes('Weighted Pull-Ups'), 'non-barbell lifts stay');
        expect(scheduleText.includes('4 × 6-8') && scheduleText.includes('3 × 8-10'), 'set prescriptions stay');
        await assertStorageUntouched(session);

        await shot(session, 'schedule-dumbbell-desktop.png', 1100, 2200, false, '#scheduleDaysContainer');
        await shot(session, 'schedule-dumbbell-mobile.png', 390, 2600, true, '#scheduleDaysContainer');

        await session.navigate(`${origin}/tracker.html`);
        await session.waitFor(`document.getElementById('daySelector') && document.getElementById('daySelector').options.length > 0`);
        await assertStorageUntouched(session);
        const loadedNames = await session.eval(`(() => {
            document.getElementById('daySelector').value = '0';
            updateLoadPreview();
            loadWorkoutFromSchedule();
            return Array.from(document.querySelectorAll('#exercises-container .exercise-name')).map(input => input.value);
        })()`);
        expect(loadedNames[0] === 'Dumbbell Bench Press', `Monday load started with ${loadedNames[0]}`);
        expect(loadedNames.join('|') === [
            'Dumbbell Bench Press',
            'Incline Dumbbell Press',
            'Cable Chest Fly',
            'Cable Tricep Pushdown',
            'Hanging Leg Raises'
        ].join('|'), `Monday names: ${loadedNames.join(', ')}`);

        const dumbbellCard = await session.eval(`document.getElementById('progress-1').textContent`);
        expect(dumbbellCard.includes('No saved history'), 'barbell history is not shown as dumbbell progress');
        expect(!dumbbellCard.includes('185'), 'barbell weight did not transfer');

        await session.eval(`(() => {
            const input = document.getElementById('exercise-1');
            const previous = input.value;
            input.value = 'Barbell Bench Press';
            showProgressiveOverloadHint(1);
            input.value = previous;
            return document.getElementById('progress-1').textContent;
        })()`);
        // Restoring the scheduled name must not keep the barbell chart.
        await session.eval(`showProgressiveOverloadHint(1)`);
        const restored = await session.eval(`document.getElementById('progress-1').textContent`);
        expect(restored.includes('No saved history'), 'scheduled dumbbell card stays free of barbell history');

        const barbellChart = await session.eval(`(() => {
            const input = document.getElementById('exercise-2');
            input.value = 'Barbell Bench Press';
            showProgressiveOverloadHint(2);
            return document.getElementById('progress-2').textContent;
        })()`);
        expect(barbellChart.includes('185 lb'), `saved barbell log still reads as barbell, saw ${barbellChart.slice(0, 180)}`);
        await assertStorageUntouched(session);

        await session.eval(`(() => {
            document.querySelectorAll('.exercise-name').forEach((input, index) => {
                if (index === 0) input.value = 'Dumbbell Bench Press';
            });
            showProgressiveOverloadHint(1);
            return true;
        })()`);
        await shot(session, 'tracker-monday-dumbbell-desktop.png', 1100, 1600, false, '.exercise-entry');
        await shot(session, 'tracker-monday-dumbbell-mobile.png', 390, 1800, true, '.exercise-entry');
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

async function seed(session) {
    await session.eval(`(() => {
        localStorage.setItem('workouts', ${JSON.stringify(JSON.stringify(savedWorkouts))});
        localStorage.setItem('customSchedule', ${JSON.stringify(JSON.stringify(customSchedule))});
        localStorage.setItem('currentUser', 'default');
        return true;
    })()`);
}

async function assertStorageUntouched(session) {
    const stored = await session.eval(`({
        workouts: localStorage.getItem('workouts'),
        customSchedule: localStorage.getItem('customSchedule')
    })`);
    expect(stored.workouts === JSON.stringify(savedWorkouts), 'saved workouts were rewritten');
    expect(stored.customSchedule === JSON.stringify(customSchedule), 'custom schedule blob was rewritten');
}

async function shot(session, filename, width, height, mobile, selector) {
    await session.viewport(width, Math.max(height, 2400), mobile);
    const box = await session.eval(`(() => {
        document.querySelectorAll('nav, .bottom-nav').forEach(node => { node.style.display = 'none'; });
        document.querySelectorAll('.example-banner').forEach(node => node.remove());
        const el = document.querySelector(${JSON.stringify(selector)});
        const bar = document.createElement('div');
        bar.className = 'example-banner';
        bar.textContent = 'EXAMPLE DATA — synthetic fixture. Saved barbell logs are not part of this default.';
        bar.style.cssText = 'background:#111;color:#BFFF00;font:700 12px/1.35 Outfit,sans-serif;letter-spacing:.03em;text-transform:uppercase;padding:8px 10px;border-radius:8px;margin:0 0 12px;text-align:center;';
        el.parentElement.insertBefore(bar, el);
        const top = bar.getBoundingClientRect();
        const card = el.getBoundingClientRect();
        const pad = 8;
        const y = Math.min(top.y, card.y);
        const bottom = Math.max(top.bottom, card.bottom);
        return {
            x: Math.max(0, Math.min(top.x, card.x) + window.scrollX - pad),
            y: Math.max(0, y + window.scrollY - pad),
            width: Math.ceil(Math.max(top.width, card.width) + pad * 2),
            height: Math.ceil(bottom - y + pad * 2)
        };
    })()`);
    const png = await session.screenshot(box);
    await writeFile(path.join(artifacts, filename), png);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function httpGet(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
        });
        req.on('error', reject);
        req.setTimeout(2000, () => req.destroy(new Error('timeout')));
    });
}

async function waitForHttp(url) {
    for (let i = 0; i < 50; i++) {
        try {
            const res = await httpGet(url);
            if (res.status === 200) return;
        } catch { /* starting */ }
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
                    expression,
                    returnByValue: true,
                    awaitPromise: true
                }, sessionId);
                if (result.exceptionDetails) {
                    throw new Error(result.exceptionDetails.exception && result.exceptionDetails.exception.description || result.exceptionDetails.text);
                }
                return result.result.value;
            },
            async waitFor(expression) {
                const started = Date.now();
                while (Date.now() - started < 20000) {
                    try {
                        if (await this.eval(`!!(${expression})`)) return;
                    } catch { /* navigating */ }
                    await delay(100);
                }
                throw new Error(`timed out waiting for ${expression}`);
            },
            viewport(width, height, mobile) {
                return send('Emulation.setDeviceMetricsOverride', {
                    width, height, deviceScaleFactor: 1, mobile: !!mobile
                }, sessionId);
            },
            async screenshot(clip) {
                const result = await send('Page.captureScreenshot', {
                    format: 'png',
                    captureBeyondViewport: true,
                    clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 2 }
                }, sessionId);
                return Buffer.from(result.data, 'base64');
            }
        };
    })();
}
