/**
 * Regression tests for all-time best-set progress.
 * Runs in Node with the real exercise catalog. No browser and no network.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = {
    console,
    localStorage: {
        getItem() { return null; },
        setItem() {},
        removeItem() {}
    }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function load(rel) {
    const file = path.join(root, rel);
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}

load('js/utils/dates.js');
load('js/data/exercises.js');
load('js/data/exercise-progress.js');

const P = sandbox.LiftLogicProgress;

function memoryStorage(initial) {
    const data = Object.assign({}, initial);
    const seen = [];
    return {
        seen,
        getItem(key) {
            seen.push(key);
            return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
        },
        setItem(key, value) { data[key] = String(value); },
        removeItem(key) { delete data[key]; }
    };
}

function history(name, workouts, userId, extra) {
    const storage = memoryStorage(Object.assign({
        workouts: JSON.stringify(workouts || [])
    }, extra || {}));
    const model = P.buildHistory(name, { userId: userId || 'default', storage });
    model.storageSeen = storage.seen;
    return model;
}

function lift(date, exercises, extra) {
    return Object.assign({ date, exercises }, extra || {});
}

function sets(list) {
    return list.map(([weight, reps]) => ({ weight, reps }));
}

test('storage keys follow the active profile and never the tombstone list', () => {
    assert.strictEqual(P.storageKeyFor('default'), 'workouts');
    assert.strictEqual(P.storageKeyFor(''), 'workouts');
    assert.strictEqual(P.storageKeyFor('lifter2'), 'lifter2_workouts');
    const model = history('Incline Dumbbell Press', [], 'default', {
        workouts_tombstones: JSON.stringify([lift('2025-01-01', [{ kind: 'Incline Dumbbell Press', sets: sets([[500, 10]]) }])])
    });
    assert.deepStrictEqual(model.storageSeen, ['workouts']);
    assert.strictEqual(model.points.length, 0);
});

test('best set is the highest weight × reps, not the sum of the session', () => {
    const model = history('Dumbbell Bench Press', [
        lift('2024-05-01', [{
            kind: 'Dumbbell Bench Press',
            sets: sets([[100, 8], [100, 8], [90, 8], [80, 10]])
        }])
    ]);
    assert.strictEqual(model.points.length, 1);
    assert.strictEqual(model.points[0].weight, 100);
    assert.strictEqual(model.points[0].reps, 8);
    assert.strictEqual(model.points[0].value, 800);
    assert.notStrictEqual(model.points[0].value, 100 * 8 + 100 * 8 + 90 * 8 + 80 * 10);
});

test('ties on weight × reps keep the heavier set', () => {
    const model = history('Dumbbell Bench Press', [
        lift('2024-05-01', [{
            kind: 'Dumbbell Bench Press',
            sets: sets([[80, 10], [100, 8]])
        }])
    ]);
    assert.strictEqual(model.points[0].weight, 100);
    assert.strictEqual(model.points[0].reps, 8);
    assert.strictEqual(model.points[0].value, 800);
});

test('all-time history includes sessions older than 30 days and keeps date order', () => {
    const model = history('Dumbbell Bench Press', [
        lift('2025-11-01', [{ kind: 'Dumbbell Bench Press', sets: sets([[90, 8]]) }]),
        lift('2020-01-15', [{ kind: 'Dumbbell Bench Press', sets: sets([[40, 8]]) }]),
        lift('2024-06-01', [{ kind: 'Dumbbell Bench Press', sets: sets([[70, 8]]) }])
    ]);
    assert.deepStrictEqual(Array.from(model.points.map(p => p.date)), ['2020-01-15', '2024-06-01', '2025-11-01']);
    assert.strictEqual(model.status, 'trend');
    assert.match(model.summary, /3 sessions, Jan 15, 2020/);
    assert.doesNotMatch(model.summary + model.note, /last 30|30-day|past 30/i);
});

test('aliases collapse to one exercise and unrelated names stay apart', () => {
    assert.strictEqual(P.sameExercise('Incline Dumbbell Press', 'Dumbbell Bench Press - Incline'), true);
    assert.strictEqual(P.sameExercise('incline dumbbell press', 'Incline Dumbbell Press'), true);
    assert.strictEqual(P.sameExercise('dips', 'Dips'), true);
    assert.strictEqual(P.sameExercise('Dumbbell Bench Press', 'Incline Dumbbell Press'), false);
    assert.strictEqual(P.sameExercise('Dumbbell Bench Press', 'Dumbbell Bench Press - Incline'), false);
    assert.strictEqual(P.sameExercise('Row', 'Barbell Bent-Over Row'), false);
    assert.strictEqual(P.sameExercise('Curl', 'Barbell Curl'), false);
    assert.strictEqual(P.sameExercise('Zercher Hold', 'Zercher Holds'), true);
    assert.strictEqual(P.sameExercise('Zercher Hold', 'Zercher Hold Variation'), false);

    const model = history('Incline Dumbbell Press', [
        lift('2024-06-01', [{ kind: 'Dumbbell Bench Press - Incline', sets: sets([[60, 8]]) }]),
        lift('2024-07-01', [{ kind: 'Dumbbell Bench Press', sets: sets([[200, 5]]) }]),
        lift('2024-08-01', [{ kind: 'Incline Dumbbell Press', sets: sets([[65, 8]]) }])
    ]);
    assert.deepStrictEqual(Array.from(model.points.map(p => p.weight)), [60, 65]);
    assert.ok(model.points.every(p => p.value !== 1000));
});

test('active profile only — other profiles and tombstones do not leak in', () => {
    const workouts = [
        lift('2024-05-01', [{ kind: 'Incline Dumbbell Press', sets: sets([[50, 8]]) }]),
        { deleted: true, date: '2025-12-01', exercises: [{ kind: 'Incline Dumbbell Press', sets: sets([[400, 10]]) }] },
        { type: 'ride', date: '2025-01-01', exercises: [{ kind: 'Incline Dumbbell Press', sets: sets([[300, 10]]) }] }
    ];
    const storage = memoryStorage({
        workouts: JSON.stringify(workouts),
        lifter2_workouts: JSON.stringify([
            lift('2025-08-01', [{ kind: 'Incline Dumbbell Press', sets: sets([[20, 5]]) }])
        ]),
        workouts_tombstones: JSON.stringify([
            { id: 'gone', deleted: true, date: '2025-09-01', exercises: [{ kind: 'Incline Dumbbell Press', sets: sets([[500, 10]]) }] }
        ])
    });
    const mine = P.buildHistory('Incline Dumbbell Press', { userId: 'default', storage });
    assert.strictEqual(mine.points.length, 1);
    assert.strictEqual(mine.points[0].weight, 50);
    assert.strictEqual(mine.points[0].value, 400);

    const other = P.buildHistory('Incline Dumbbell Press', { userId: 'lifter2', storage });
    assert.strictEqual(other.points.length, 1);
    assert.strictEqual(other.points[0].weight, 20);
    assert.strictEqual(other.points[0].value, 100);
    assert.notStrictEqual(other.storageKey, mine.storageKey);
});

test('old and new set schemas, invalid sets, and same-day merges', () => {
    const model = history('Incline Dumbbell Press', [
        {
            dailyInfo: { currentDate: '2022-11-02', currentTime: '18:00', bodyWeight: '180' },
            exercises: [{ kind: 'Incline Dumbbell Press', sets: 4, weight: 30, reps: 8 }]
        },
        lift('2024-04-01', [{
            kind: 'Incline Dumbbell Press',
            sets: [{ weight: 'heavy', reps: 'lots' }, { weight: '65', reps: '8' }, { weight: -5, reps: 5 }, { weight: '40kg', reps: 8 }],
            weight: 999,
            reps: 10
        }]),
        lift('2024-01-05', [{ kind: 'Incline Dumbbell Press', sets: ['50x8', '45 × 8'] }]),
        lift('2024-1-5', [{ kind: 'incline dumbbell press', sets: [{ Weight: 55, Reps: 8 }] }]),
        { date: '2024-02-31', exercises: [{ kind: 'Incline Dumbbell Press', sets: sets([[500, 10]]) }] },
        { exercises: [{ kind: 'Incline Dumbbell Press', sets: sets([[500, 10]]) }] }
    ]);
    const byDate = Object.fromEntries(model.points.map(p => [p.date, p]));
    assert.strictEqual(byDate['2022-11-02'].value, 240);
    assert.strictEqual(byDate['2022-11-02'].reps, 8);
    assert.notStrictEqual(byDate['2022-11-02'].value, 960);
    assert.strictEqual(byDate['2024-04-01'].weight, 65);
    assert.strictEqual(byDate['2024-04-01'].value, 520);
    assert.ok(!byDate['2024-02-31']);
    // Same calendar day merges; 55×8 beats 50×8. The legacy 999×10 duplicate is ignored.
    assert.strictEqual(byDate['2024-01-05'].weight, 55);
    assert.strictEqual(byDate['2024-01-05'].value, 440);
    assert.strictEqual(model.points.length, 3);
});

test('unusable sets array falls back to the legacy weight and reps', () => {
    const model = history('Goblet Squat', [
        lift('2023-03-01', [{
            kind: 'Goblet Squat',
            sets: [{ weight: 'nope', reps: '' }],
            weight: 40,
            reps: 10
        }])
    ]);
    assert.strictEqual(model.points[0].weight, 40);
    assert.strictEqual(model.points[0].reps, 10);
    assert.strictEqual(model.points[0].value, 400);
});

test('empty, single session, and incomplete external load', () => {
    const empty = history('Incline Dumbbell Press', []);
    assert.strictEqual(empty.status, 'empty');
    assert.match(empty.summary, /No saved history for this exercise on this profile/);
    assert.doesNotMatch(P.toHtml(empty), /<svg/);

    const single = history('Dumbbell Bench Press', [
        lift('2024-05-01', [{ kind: 'Dumbbell Bench Press', sets: sets([[80, 8]]) }])
    ]);
    assert.strictEqual(single.status, 'single');
    assert.match(single.summary, /One saved session \(May 1, 2024\)/);
    assert.match(single.summary, /Log it again to see a trend/);
    assert.match(single.context, /Epley/);

    const incomplete = history('Dumbbell Bench Press', [
        lift('2024-05-01', [{ kind: 'Dumbbell Bench Press', sets: [{ weight: 0, reps: 8 }, { reps: 5 }] }])
    ]);
    assert.strictEqual(incomplete.status, 'incomplete');
    assert.match(incomplete.summary, /Body mass is not assumed/);
    assert.strictEqual(incomplete.points.length, 0);
});

test('corrupt storage and a non-array payload do not throw', () => {
    const bad = memoryStorage({ workouts: '{not json' });
    const model = P.buildHistory('Dumbbell Bench Press', { userId: 'default', storage: bad });
    assert.strictEqual(model.status, 'empty');
    const obj = memoryStorage({ workouts: '{"date":"2024-01-01"}' });
    assert.strictEqual(P.buildHistory('Dumbbell Bench Press', { storage: obj }).status, 'empty');
});

// The SVG is 180px tall; its sizing attributes are not plotted numbers.
const stripSvgSize = (html) => html.replace(/viewBox="[^"]*"|\b(?:width|height)="\d+"/g, '');

test('bodyweight sets plot reps and do not invent body mass', () => {
    const model = history('Pull-Ups', [
        lift('2024-02-01', [{ kind: 'Pull-Ups', sets: sets([[0, 5], [0, 6], [0, 4]]) }], { bodyWeight: 180 }),
        lift('2024-08-01', [{ kind: 'pull ups', sets: [{ reps: 8 }] }], { bodyWeight: 185 }),
        lift('2025-04-01', [{ kind: 'Pull-Ups', sets: sets([[0, 10]]) }], { bodyWeight: 190 })
    ]);
    assert.strictEqual(model.mode, 'reps');
    assert.strictEqual(model.bodyMass, true);
    assert.deepStrictEqual(Array.from(model.points.map(p => p.value)), [6, 8, 10]);
    assert.ok(model.points.every(p => p.weight === 0));
    const html = P.toHtml(model);
    assert.match(html, /bodyweight × 10 reps/);
    assert.match(html, /not invented/);
    assert.match(html, /not total-bodyweight/);
    assert.doesNotMatch(stripSvgSize(html), /180|185|190/);
    assert.doesNotMatch(html, /\d lb ×/);
    assert.doesNotMatch(model.context, /Epley/);
    assert.match(model.context, /not a strength score/);
});

test('weighted bodyweight uses added load only and drops bodyweight-only days', () => {
    const model = history('Weighted Pull-Ups', [
        lift('2024-03-01', [{ kind: 'Weighted Pull-Ups', sets: sets([[25, 5], [25, 4]]) }], { bodyWeight: 180 }),
        lift('2024-09-01', [{ kind: 'Weighted Pull-Ups', sets: sets([[0, 12]]) }], { bodyWeight: 180 }),
        lift('2025-03-01', [{ kind: 'Weighted Pull-Ups', sets: sets([[35, 5]]) }], { bodyWeight: 182 })
    ]);
    assert.strictEqual(model.mode, 'added');
    assert.strictEqual(model.omittedBodyweightSessions, 1);
    assert.deepStrictEqual(Array.from(model.points.map(p => p.value)), [125, 175]);
    assert.ok(model.points.every(p => p.value !== (180 + 25) * 5 && p.value !== (182 + 35) * 5));
    const html = P.toHtml(model);
    assert.match(html, /added weight × reps/);
    assert.match(html, /Body mass is not included/);
    assert.match(html, /not total-bodyweight strength/);
    assert.match(html, /1 bodyweight-only session is not on the line/);
    assert.match(html, /35 lb added × 5/);
    assert.doesNotMatch(stripSvgSize(html), /180|182/);
});

test('load chart explains rep differences and does not call volume strength', () => {
    const model = history('Incline Dumbbell Press', [
        lift('2025-08-01', [{ kind: 'Incline Dumbbell Press', sets: sets([[80, 8], [70, 8]]) }]),
        lift('2025-09-01', [{ kind: 'Incline Dumbbell Press', sets: sets([[70, 6]]) }]),
        lift('2025-10-01', [{ kind: 'Incline Dumbbell Press', sets: sets([[55, 10], [50, 10]]) }])
    ]);
    assert.strictEqual(model.points[2].value, 550);
    assert.strictEqual(model.points[1].value, 420);
    assert.match(model.summary, /55 lb × 10 \(550 lb·reps\), up 130 lb·reps from Sep 1, 2025 \(70 lb × 6\)/);
    assert.match(model.summary, /All-time best by this metric is 80 lb × 8 \(640 lb·reps\) on Aug 1, 2025/);
    assert.match(model.context, /Reps went from 6 to 10/);
    assert.match(model.context, /Best-set work is up, but estimated strength of that set is down \(Epley 73 lb vs 84 lb last time\)/);
    assert.match(model.note, /not a direct measure of strength/);
    assert.match(model.note, /not drawn from zero/);
    const html = P.toHtml(model);
    assert.match(html, /55 lb × 10/);
    assert.match(html, /reps were 6 last time/);
    assert.match(html, /role="slider"/);
    assert.match(html, /All sessions \(3\)/);
    const circles = [...html.matchAll(/data-i="(\d+)" cx="([\d.]+)" cy="([\d.]+)"/g)];
    assert.strictEqual(circles.length, 3);
    assert.ok(Number(circles[0][2]) < Number(circles[2][2]));
    // 80×8 is the peak, so its cy is above the lighter latest set.
    assert.ok(Number(circles[0][3]) < Number(circles[2][3]));
});

test('exercise names are not injected as HTML', () => {
    const nasty = '<img src=x onerror=alert(1)>';
    const model = history(nasty, [
        lift('2024-01-01', [{ kind: nasty, sets: sets([[100, 5]]) }])
    ]);
    const html = P.toHtml(model);
    assert.doesNotMatch(html, /<img/i);
    assert.doesNotMatch(html, /<script/i);
    assert.match(html, /100 lb × 5/);
});

test('mounting replaces listeners instead of stacking them', () => {
    function fakeContainer() {
        const svgs = [];
        let html = '';
        return {
            hidden: true,
            dataset: {},
            svgs,
            get innerHTML() { return html; },
            set innerHTML(value) {
                html = String(value);
                this._svg = null;
                this._readout = null;
            },
            removeAttribute() {},
            querySelector(sel) {
                if (sel === '.progress-svg') {
                    if (!this.innerHTML.includes('class="progress-svg"')) return null;
                    if (!this._svg || this._svg.html !== this.innerHTML) {
                        const listeners = new Map();
                        const svg = {
                            html: this.innerHTML,
                            listeners,
                            setAttribute() {},
                            querySelectorAll() { return []; },
                            setPointerCapture() {},
                            addEventListener(type, fn) {
                                if (!listeners.has(type)) listeners.set(type, new Set());
                                listeners.get(type).add(fn);
                            },
                            removeEventListener(type, fn) {
                                const set = listeners.get(type);
                                if (set) set.delete(fn);
                            },
                            getBoundingClientRect() { return { left: 0, width: 320, height: 150 }; },
                            listenerCount() {
                                let n = 0;
                                listeners.forEach(set => { n += set.size; });
                                return n;
                            }
                        };
                        this._svg = svg;
                        svgs.push(svg);
                    }
                    return this._svg;
                }
                if (sel === '.progress-readout' && this.innerHTML.includes('progress-readout')) {
                    if (!this._readout || this._readout.html !== this.innerHTML) {
                        this._readout = { html: this.innerHTML, textContent: '' };
                    }
                    return this._readout;
                }
                return null;
            }
        };
    }

    const model = history('Dumbbell Bench Press', [
        lift('2024-05-01', [{ kind: 'Dumbbell Bench Press', sets: sets([[80, 8]]) }]),
        lift('2025-05-01', [{ kind: 'Dumbbell Bench Press', sets: sets([[90, 8]]) }])
    ]);
    const card = fakeContainer();
    for (let i = 0; i < 5; i++) P.mount(card, model);
    assert.strictEqual(P.activeMounts(), 1);
    assert.strictEqual(card.svgs.length, 5);
    card.svgs.slice(0, 4).forEach(svg => assert.strictEqual(svg.listenerCount(), 0));
    assert.strictEqual(card.svgs[4].listenerCount(), 3);
    assert.match(card._readout.textContent, /90 lb × 8/);

    const onKey = [...card.svgs[4].listeners.get('keydown')][0];
    onKey({ key: 'ArrowLeft', preventDefault() {} });
    assert.match(card._readout.textContent, /80 lb × 8/);
    onKey({ key: 'End', preventDefault() {} });
    assert.match(card._readout.textContent, /90 lb × 8/);

    const other = fakeContainer();
    P.mount(other, model);
    assert.strictEqual(P.activeMounts(), 2);
    P.unmount(card);
    assert.strictEqual(card.svgs[4].listenerCount(), 0);
    assert.strictEqual(P.activeMounts(), 1);
    P.clear(other);
    assert.strictEqual(other.hidden, true);
    assert.strictEqual(other.innerHTML, '');
    assert.strictEqual(P.activeMounts(), 0);
});
