/**
 * Isolated browser checks for the tracker progress chart.
 * Uses a fresh Chrome profile and synthetic localStorage only.
 * Does not sign in to Firebase and does not write real user data.
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
const serverPort = 20000 + (process.pid % 10000);
const chromePort = 30000 + (process.pid % 10000);

function sets(list) {
    return list.map(([weight, reps]) => ({ weight, reps }));
}

const defaultWorkouts = [
    {
        dailyInfo: { currentDate: '2022-11-02', currentTime: '18:00', bodyWeight: '180' },
        exercises: [{ kind: 'Incline Dumbbell Press', sets: 4, weight: 30, reps: 8 }]
    },
    {
        date: '2023-06-10',
        exercises: [{ kind: 'Incline Dumbbell Press', sets: sets([[40, 8], [45, 8], [45, 8]]) }]
    },
    {
        date: '2024-06-01',
        exercises: [{ kind: 'Dumbbell Bench Press - Incline', sets: sets([[60, 8], [55, 8]]) }]
    },
    {
        date: '2025-08-01',
        exercises: [{ kind: 'Incline Dumbbell Press', sets: sets([[80, 8], [70, 6], [60, 8]]) }]
    },
    {
        date: '2025-09-01',
        exercises: [{ kind: 'Incline Dumbbell Press', sets: sets([[70, 6]]) }]
    },
    {
        date: '2025-10-01',
        exercises: [{ kind: 'Incline Dumbbell Press', sets: sets([[55, 10], [50, 10]]) }]
    },
    {
        deleted: true,
        date: '2021-05-01',
        exercises: [{ kind: 'Incline Dumbbell Press', sets: sets([[400, 10]]) }]
    },
    { type: 'ride', date: '2025-10-15', rideName: 'Easy spin', durationMin: 40 },
    {
        date: '2024-05-01',
        exercises: [{ kind: 'Dumbbell Bench Press', sets: sets([[80, 8], [75, 8]]) }]
    },
    {
        date: '2025-05-01',
        exercises: [{ kind: 'Dumbbell Bench Press', sets: sets([[90, 8], [85, 8], [80, 8]]) }]
    },
    {
        date: '2024-02-01',
        bodyWeight: 180,
        exercises: [{ kind: 'Pull-Ups', sets: sets([[0, 5], [0, 6]]) }]
    },
    {
        date: '2024-08-01',
        bodyWeight: 185,
        exercises: [{ kind: 'Pull-Ups', sets: [{ reps: 8 }] }]
    },
    {
        date: '2025-04-01',
        bodyWeight: 190,
        exercises: [{ kind: 'Pull-Ups', sets: sets([[0, 10]]) }]
    },
    {
        date: '2024-03-01',
        bodyWeight: 180,
        exercises: [{ kind: 'Weighted Pull-Ups', sets: sets([[25, 5], [25, 4]]) }]
    },
    {
        date: '2024-09-01',
        bodyWeight: 180,
        exercises: [{ kind: 'Weighted Pull-Ups', sets: sets([[0, 12]]) }]
    },
    {
        date: '2025-06-01',
        bodyWeight: 182,
        exercises: [{ kind: 'Weighted Pull-Ups', sets: sets([[35, 5]]) }]
    },
    {
        date: '2024-07-01',
        exercises: [{ kind: 'Barbell Bench Press', sets: sets([[135, 5], [135, 5]]) }]
    },
    {
        date: '2025-07-01',
        exercises: [{ kind: 'Barbell Bench Press', sets: sets([[155, 5], [145, 5], [145, 4]]) }]
    },
    {
        date: '2024-07-02',
        exercises: [{ kind: 'Dumbbell Bench Press', sets: sets([[60, 8], [60, 8]]) }]
    },
    {
        date: '2025-07-02',
        exercises: [{ kind: 'Dumbbell Bench Press', sets: sets([[70, 8], [65, 8]]) }]
    }
];

const lifter2Workouts = [
    { date: '2025-10-01', exercises: [{ kind: 'Incline Dumbbell Press', sets: sets([[20, 5]]) }] }
];

const tombstones = [
    {
        id: 'gone',
        deleted: true,
        date: '2025-07-01',
        exercises: [{ kind: 'Incline Dumbbell Press', sets: sets([[500, 10]]) }]
    }
];

const profiles = {
    default: { id: 'default', name: 'Default User', email: '', createdAt: '2020-01-01T00:00:00.000Z' },
    lifter2: { id: 'lifter2', name: 'Lifter Two', email: '', createdAt: '2020-01-01T00:00:00.000Z' }
};

const hasChrome = spawnSync('google-chrome', ['--version'], { encoding: 'utf8' }).status === 0;

test('tracker progress chart in an isolated browser', {
    timeout: 120000,
    skip: hasChrome ? false : 'google-chrome is not installed'
}, async () => {
    await mkdir(artifacts, { recursive: true });
    const userData = await mkdtemp(path.join(tmpdir(), 'll-chrome-'));
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
        await waitForHttp(`http://127.0.0.1:${serverPort}/tracker.html`);
        const version = await waitForJson(`http://127.0.0.1:${chromePort}/json/version`);
        ws = new WebSocket(version.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            ws.addEventListener('open', resolve, { once: true });
            ws.addEventListener('error', reject, { once: true });
        });
        const session = await connectPage(ws);

        await session.navigate(`http://127.0.0.1:${serverPort}/tracker.html`);
        await session.waitFor(`document.getElementById('exercise-1')`);
        await session.eval(`(() => {
            localStorage.setItem('workouts', ${JSON.stringify(JSON.stringify(defaultWorkouts))});
            localStorage.setItem('lifter2_workouts', ${JSON.stringify(JSON.stringify(lifter2Workouts))});
            localStorage.setItem('workouts_tombstones', ${JSON.stringify(JSON.stringify(tombstones))});
            localStorage.setItem('userProfiles', ${JSON.stringify(JSON.stringify(profiles))});
            localStorage.setItem('currentUser', 'default');
            return true;
        })()`);
        await session.reload();
        await session.waitFor(`document.getElementById('exercise-1') && document.getElementById('daySelector').options.length > 0`);

        const initial = await session.eval(`(() => {
            const root = document.getElementById('progress-1');
            return {
                hidden: root.hidden,
                svgs: document.querySelectorAll('.progress-svg').length,
                mounts: LiftLogicProgress.activeMounts()
            };
        })()`);
        expect(initial.hidden === true, 'empty exercise does not show a chart yet');
        expect(initial.svgs === 0 && initial.mounts === 0, 'no chart is mounted before a name is chosen');

        await setExercise(session, 1, 'Incline Dumbbell Press');
        const incline = await readCard(session, 1);
        expect(incline.hidden === false, 'choosing an exercise reveals progress');
        expect(incline.svgs === 1, 'one chart for one exercise');
        expect(incline.mode === 'load' && incline.status === 'trend', `incline mode ${incline.mode} ${incline.status}`);
        expect(incline.points === '6', `expected 6 incline sessions, got ${incline.points}`);
        expect(incline.text.includes('55 lb × 10'), 'latest best set weight and reps are visible');
        expect(incline.text.includes('80 lb × 8'), 'all-time best set is visible');
        expect(incline.text.includes('Nov 2, 2022'), 'history older than 30 days is included');
        expect(incline.text.includes('not a direct measure of strength'), 'volume is not described as strength');
        expect(incline.text.includes('not drawn from zero'), 'zoomed axis is labeled');
        expect(incline.text.includes('Best-set work is up, but estimated strength of that set is down'), 'rep-driven gains are called out');
        expect(!incline.text.includes('400 lb') && !incline.text.includes('500 lb'), 'deleted and tombstoned sessions are excluded');
        expect(incline.hint.includes('Last Workout'), 'existing last-workout hint still renders');
        expect(incline.restButtons === 4, 'rest timer presets still render');

        await setExercise(session, 1, 'Incline Dumbbell Press');
        const again = await readCard(session, 1);
        expect(again.svgs === 1 && LiftLogicStillOne(again), 'renaming to the same exercise does not stack charts');

        const beforeSets = incline.text;
        await session.eval(`addSet(1)`);
        const afterAdd = await readCard(session, 1);
        expect(afterAdd.setEntries === incline.setEntries + 1, 'add set still adds a row');
        expect(afterAdd.text === beforeSets, 'unsaved sets do not change saved history');
        expect(afterAdd.svgs === 1, 'adding a set does not duplicate the chart');

        await session.eval(`document.querySelector('#exercise-1').closest('.exercise-entry').querySelector('.apply-suggestion-btn').click()`);
        const applied = await session.eval(`(() => {
            const entry = document.getElementById('exercise-1').closest('.exercise-entry');
            return {
                weight: entry.querySelector('.set-weight').value,
                reps: entry.querySelector('.set-reps').value,
                chart: document.getElementById('progress-1').textContent
            };
        })()`);
        expect(applied.weight !== '' && applied.reps !== '', 'apply suggestion still fills empty set inputs');
        expect(applied.chart === beforeSets, 'apply suggestion does not rewrite history');

        await session.eval(`document.querySelector('#rest-timer-1 .btn-timer').click()`);
        const rest = await session.eval(`document.querySelector('#rest-display-1 .rest-time').textContent`);
        expect(rest !== '0:00', `rest timer still runs, saw ${rest}`);

        await session.eval(`(() => {
            const svg = document.querySelector('.progress-svg');
            svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
            return true;
        })()`);
        const scrubbed = await session.eval(`document.querySelector('#progress-1 .progress-readout').textContent`);
        expect(scrubbed.includes('70 lb × 6'), `arrow keys read the previous session, saw ${scrubbed}`);
        await session.eval(`document.querySelector('.progress-svg').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))`);

        const mobileOverflow = await overflow(session, 390, 844, true);
        expect(mobileOverflow.progress <= 1, `progress card overflows by ${mobileOverflow.progress}px on mobile`);
        expect(mobileOverflow.page <= 1, `page overflows by ${mobileOverflow.page}px on mobile`);
        const desktopOverflow = await overflow(session, 1280, 900, false);
        expect(desktopOverflow.progress <= 1, `progress card overflows by ${desktopOverflow.progress}px on desktop`);
        expect(desktopOverflow.page <= 1, `page overflows by ${desktopOverflow.page}px on desktop`);

        await shot(session, 'exercise-progress-desktop.png', 1280, 1700, false);
        await shot(session, 'exercise-progress-mobile.png', 390, 1800, true);

        await setExercise(session, 1, 'Dumbbell Bench Press');
        const bench = await readCard(session, 1);
        expect(bench.svgs === 1, 'changing exercise keeps a single chart');
        expect(bench.text.includes('90 lb × 8'), 'bench history is its own');
        expect(!bench.text.includes('55 lb × 10'), 'incline sets are not mixed into bench');

        await setExercise(session, 1, 'Pull-Ups');
        const bw = await readCard(session, 1);
        expect(bw.mode === 'reps', `pull-ups mode ${bw.mode}`);
        expect(bw.text.includes('bodyweight × 10 reps'), 'bodyweight chart shows reps');
        expect(bw.text.includes('not invented'), 'missing body mass is not invented');
        expect(!/180|185|190/.test(bw.text), 'logged body weight is not plotted as the load');
        expect(bw.hint.includes('BW') && !bw.hint.includes('35lb'), 'pull-up suggestion stays on pull-ups, not weighted pull-ups');

        await setExercise(session, 1, 'Weighted Pull-Ups');
        const added = await readCard(session, 1);
        expect(added.mode === 'added', `weighted pull-up mode ${added.mode}`);
        expect(added.text.includes('35 lb added × 5'), 'added load is shown as added load');
        expect(added.hint.includes('35lb'), 'weighted pull-up suggestion uses the added load');
        expect(added.text.includes('Body mass is not included'), 'added load is not called total bodyweight');
        expect(added.text.includes('not on the line'), 'bodyweight-only sessions are omitted from the line');
        expect(!/180|182/.test(added.text), 'body weight is not added to the belt weight');

        await setExercise(session, 1, 'Zercher Hold');
        const empty = await readCard(session, 1);
        expect(empty.status === 'empty' && empty.svgs === 0, 'unknown exercise with no saves shows an empty state');
        expect(empty.text.includes('No saved history for this exercise on this profile'), empty.text);
        await shot(session, 'exercise-progress-empty-desktop.png', 1280, 1400, false);
        await shot(session, 'exercise-progress-empty-mobile.png', 390, 1500, true);

        await setExercise(session, 1, 'Pull-Ups');
        await shot(session, 'exercise-progress-bodyweight-mobile.png', 390, 1700, true);
        await setExercise(session, 1, 'Weighted Pull-Ups');
        await shot(session, 'exercise-progress-added-load-mobile.png', 390, 1800, true);

        await session.eval(`removeExercise(1)`);
        const removed = await session.eval(`({
            entries: document.querySelectorAll('.exercise-entry').length,
            mounts: LiftLogicProgress.activeMounts(),
            svgs: document.querySelectorAll('.progress-svg').length
        })`);
        expect(removed.entries === 0 && removed.mounts === 0 && removed.svgs === 0, `removing the exercise drops the chart and its listeners ${JSON.stringify(removed)}`);

        await session.eval(`addExercise()`);
        await setExercise(session, 2, 'Incline Dumbbell Press');
        await session.eval(`switchUser('lifter2')`);
        const other = await readCard(session, 2);
        expect(other.text.includes('20 lb × 5'), 'switching profile shows that profile history');
        expect(!other.text.includes('55 lb') && !other.text.includes('80 lb'), 'the previous profile does not leak');
        await session.eval(`switchUser('default')`);
        const back = await readCard(session, 2);
        expect(back.text.includes('80 lb × 8'), 'switching back restores the original profile');

        await session.eval(`(() => {
            const workouts = JSON.parse(localStorage.getItem('workouts'));
            const next = workouts.filter(w => w.date !== '2025-08-01');
            localStorage.setItem('workouts', JSON.stringify(next));
            showProgressiveOverloadHint(2);
            return true;
        })()`);
        const edited = await readCard(session, 2);
        expect(!edited.text.includes('80 lb × 8'), 'a removed saved workout leaves the chart');
        expect(edited.text.includes('55 lb × 10'), 'remaining saved sessions stay');

        await session.reload();
        await session.waitFor(`document.getElementById('loadWorkoutBtn') && document.getElementById('daySelector').options.length > 0`);
        await session.eval(`(() => {
            document.getElementById('daySelector').value = '0';
            updateLoadPreview();
            loadWorkoutFromSchedule();
            return document.querySelectorAll('.exercise-entry').length;
        })()`);
        const loaded = await readCard(session, 1);
        const loadedName = await session.eval(`document.getElementById('exercise-1').value`);
        expect(loadedName === 'Dumbbell Bench Press', `schedule loaded ${loadedName}`);
        expect(loaded.text.includes('70 lb × 8'), 'scheduled dumbbell exercise shows its own saved history');
        expect(!loaded.text.includes('155 lb'), 'saved barbell bench weight is not copied onto the dumbbell card');
        expect(loaded.hint.includes('Last Workout'), 'schedule load still shows the last-workout hint');
        const many = await session.eval(`document.querySelectorAll('.exercise-entry').length`);
        expect(many === 5, `Monday loads 5 exercises, saw ${many}`);
        const beforeRemove = await session.eval(`document.querySelectorAll('.progress-svg').length`);
        await session.eval(`removeExercise(1)`);
        const afterRemove = await session.eval(`({
            svgs: document.querySelectorAll('.progress-svg').length,
            mounts: LiftLogicProgress.activeMounts(),
            firstGone: !document.getElementById('exercise-1')
        })`);
        expect(afterRemove.firstGone, 'the loaded exercise card is gone');
        expect(afterRemove.svgs === beforeRemove - 1, `removing one loaded exercise drops one chart (${beforeRemove} -> ${afterRemove.svgs})`);
        expect(afterRemove.mounts === afterRemove.svgs, `mounts stay in sync with charts (${afterRemove.mounts} vs ${afterRemove.svgs})`);

    } catch (error) {
        console.error('BROWSER TEST FAILED:', error && error.stack || error);
        throw error;
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

function LiftLogicStillOne(card) {
    return card.mounts === 1;
}

async function setExercise(session, id, name) {
    await session.eval(`(() => {
        const input = document.getElementById('exercise-${id}');
        input.focus();
        input.value = ${JSON.stringify(name)};
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        showProgressiveOverloadHint(${id});
        return input.value;
    })()`);
}

async function readCard(session, id) {
    return session.eval(`(() => {
        const root = document.getElementById('progress-${id}');
        const entry = document.getElementById('exercise-${id}').closest('.exercise-entry');
        const hint = document.getElementById('hint-${id}');
        return {
            hidden: !!root.hidden,
            text: root.textContent,
            status: root.dataset.status || '',
            mode: root.dataset.mode || '',
            points: root.dataset.points || '',
            mounts: LiftLogicProgress.activeMounts(),
            svgs: document.querySelectorAll('.progress-svg').length,
            hint: hint ? hint.textContent : '',
            setEntries: entry.querySelectorAll('.set-entry').length,
            restButtons: entry.querySelectorAll('.btn-timer').length
        };
    })()`);
}

async function overflow(session, width, height, mobile) {
    await session.viewport(width, height, mobile);
    await session.eval(`document.querySelector('.exercise-entry')?.scrollIntoView()`);
    return session.eval(`(() => {
        const card = document.querySelector('.exercise-progress');
        const page = document.documentElement;
        return {
            progress: card ? card.scrollWidth - card.clientWidth : 0,
            page: page.scrollWidth - window.innerWidth
        };
    })()`);
}

async function shot(session, filename, width, height, mobile) {
    await session.viewport(width, Math.max(height, 2400), mobile);
    const box = await session.eval(`(() => {
        document.querySelectorAll('nav, .bottom-nav').forEach(node => { node.style.display = 'none'; });
        Object.keys(restTimers).forEach(id => resetRestTimer(id));
        document.querySelectorAll('.rest-time').forEach(node => {
            node.textContent = '0:00';
            node.classList.remove('counting', 'completed');
        });
        document.querySelectorAll('.rest-controls').forEach(node => { node.style.display = 'none'; });
        document.querySelectorAll('.example-banner').forEach(node => node.remove());
        const entry = document.querySelector('.exercise-entry');
        const bar = document.createElement('div');
        bar.className = 'example-banner';
        bar.textContent = 'EXAMPLE DATA — synthetic fixture, not a real training log';
        bar.style.cssText = 'background:#111;color:#F4F4F4;font:700 12px/1.35 Outfit,sans-serif;letter-spacing:.04em;text-transform:uppercase;padding:8px 10px;border-radius:8px;margin:0 0 12px;text-align:center;';
        entry.prepend(bar);
        const r = entry.getBoundingClientRect();
        const pad = 6;
        return {
            x: Math.max(0, r.x + window.scrollX - pad),
            y: Math.max(0, r.y + window.scrollY - pad),
            width: Math.ceil(r.width + pad * 2),
            height: Math.ceil(r.height + pad * 2)
        };
    })()`);
    const png = await session.screenshot(box);
    await writeFile(path.join(artifacts, filename), png);
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
        } catch { /* server still starting */ }
        await delay(100);
    }
    throw new Error(`server did not start for ${url}`);
}

async function waitForJson(url) {
    for (let i = 0; i < 50; i++) {
        try {
            const res = await httpGet(url);
            if (res.status === 200) return JSON.parse(res.body);
        } catch { /* chrome still starting */ }
        await delay(100);
    }
    throw new Error(`chrome debug port did not open: ${url}`);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
        if (message.method === 'Page.loadEventFired') {
            loadWaiters.splice(0).forEach(fn => fn());
        }
    });
    function send(method, params, sessionId) {
        const id = ++next;
        const payload = { id, method, params: params || {} };
        if (sessionId) payload.sessionId = sessionId;
        ws.send(JSON.stringify(payload));
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
                    const text = result.exceptionDetails.text || 'eval failed';
                    const desc = result.exceptionDetails.exception && result.exceptionDetails.exception.description;
                    throw new Error(desc || text);
                }
                return result.result.value;
            },
            async waitFor(expression) {
                const started = Date.now();
                while (Date.now() - started < 20000) {
                    try {
                        const ok = await this.eval(`!!(${expression})`);
                        if (ok) return;
                    } catch { /* page still navigating */ }
                    await delay(100);
                }
                throw new Error(`timed out waiting for ${expression}`);
            },
            viewport(width, height, mobile) {
                return send('Emulation.setDeviceMetricsOverride', {
                    width,
                    height,
                    deviceScaleFactor: 1,
                    mobile: !!mobile
                }, sessionId);
            },
            async screenshot(clip) {
                const result = await send('Page.captureScreenshot', {
                    format: 'png',
                    captureBeyondViewport: true,
                    clip: {
                        x: clip.x,
                        y: clip.y,
                        width: clip.width,
                        height: clip.height,
                        scale: 2
                    }
                }, sessionId);
                return Buffer.from(result.data, 'base64');
            }
        };
    })();
}
