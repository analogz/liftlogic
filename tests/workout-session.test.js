/**
 * Same-day workout resume: one lifting session per profile per local date.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = { console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/data/records.js'), 'utf8'), sandbox, { filename: 'records.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'js/data/workout-session.js'), 'utf8'), sandbox, { filename: 'workout-session.js' });

const Session = sandbox.LiftLogicSession;
const TODAY = '2026-11-09';
const YESTERDAY = '2026-11-08';

function memoryStorage(initial) {
    const data = Object.assign({}, initial || {});
    return {
        data,
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
        },
        setItem(key, value) { data[key] = String(value); },
        removeItem(key) { delete data[key]; }
    };
}

function lift(date, kind, id, extra) {
    return Object.assign({
        id: id || `${date}_1`,
        date,
        time: '18:00',
        sleepQuality: 7,
        stressLevel: 4,
        bodyWeight: 180,
        muscleSoreness: 3,
        sick: 'no',
        injured: 'no',
        exercises: [{ kind, sets: [{ weight: 50, reps: 8, rpe: null, rir: null }], pump: null }],
        duration: 600,
        updatedAt: 1
    }, extra || {});
}

function storedLifts(storage, userId) {
    const raw = storage.getItem(Session.storageKey(userId));
    return raw ? JSON.parse(raw) : [];
}

function todayLifts(storage, userId, today) {
    return storedLifts(storage, userId).filter(w => w.type !== 'ride' && (w.date === (today || TODAY)));
}

test('resume same day loads that profile\'s saved workout', () => {
    const saved = lift(TODAY, 'Dumbbell Bench Press', 'today_bench', { updatedAt: 50, sleepQuality: 8 });
    saved.exercises.push({ kind: 'Dumbbell Row', sets: [{ weight: 45, reps: 10 }], pump: 7 });
    const storage = memoryStorage({
        workouts: JSON.stringify([
            lift(YESTERDAY, 'Squat', 'yesterday'),
            saved,
            { id: 'ride_today', type: 'ride', date: TODAY, rideName: 'Loop', exercises: [] }
        ])
    });

    const decision = Session.resumeFor(storage, 'default', TODAY);

    assert.strictEqual(decision.source, 'saved');
    assert.strictEqual(decision.savedId, 'today_bench');
    assert.strictEqual(decision.form.sleepQuality, 8);
    assert.strictEqual(decision.form.exercises.length, 2);
    assert.strictEqual(decision.form.exercises[0].kind, 'Dumbbell Bench Press');
    assert.strictEqual(decision.form.exercises[0].sets[0].reps, 8);
    assert.strictEqual(decision.form.exercises[1].pump, 7);
    assert.strictEqual(decision.form.duration, 600);
});

test('a newer same-day draft wins over the saved workout', () => {
    const storage = memoryStorage({
        workouts: JSON.stringify([lift(TODAY, 'Dumbbell Bench Press', 'today_bench', { updatedAt: 10 })])
    });
    Session.writeDraft(storage, 'default', {
        date: TODAY,
        savedId: 'today_bench',
        updatedAt: 20,
        form: {
            id: 'today_bench',
            date: TODAY,
            exercises: [
                { kind: 'Dumbbell Bench Press', sets: [{ weight: 50, reps: 8 }, { weight: 50, reps: 6 }] },
                { kind: 'Dumbbell Row', sets: [{ weight: 40, reps: null }] }
            ]
        }
    });

    const decision = Session.resumeFor(storage, 'default', TODAY);

    assert.strictEqual(decision.source, 'draft');
    assert.strictEqual(decision.savedId, 'today_bench');
    assert.strictEqual(decision.form.exercises.length, 2);
    assert.strictEqual(decision.form.exercises[0].sets.length, 2);
    assert.strictEqual(decision.form.exercises[1].sets[0].reps, null);
});

test('re-save updates the same record instead of appending a session', () => {
    const storage = memoryStorage({
        workouts: JSON.stringify([
            lift(YESTERDAY, 'Squat', 'yesterday', { updatedAt: 1 }),
            lift(TODAY, 'Dumbbell Bench Press', 'today_bench', { updatedAt: 10 }),
            { id: 'ride_today', type: 'ride', date: TODAY, rideName: 'Loop', exercises: [], updatedAt: 3 }
        ])
    });
    const first = Session.resumeFor(storage, 'default', TODAY);
    const again = Session.commit(storage, 'default', {
        id: first.savedId,
        date: TODAY,
        time: '18:10',
        sleepQuality: 6,
        stressLevel: 5,
        bodyWeight: 181,
        muscleSoreness: 4,
        sick: 'no',
        injured: 'no',
        duration: 900,
        exercises: [
            { kind: 'Dumbbell Bench Press', sets: [{ weight: 55, reps: 8 }, { weight: 55, reps: 6 }] },
            { kind: 'Dumbbell Row', sets: [{ weight: 45, reps: 10 }] }
        ]
    }, { today: TODAY, now: 100 });

    const lifts = todayLifts(storage);
    assert.strictEqual(lifts.length, 1);
    assert.strictEqual(again.record.id, 'today_bench');
    assert.strictEqual(lifts[0].id, 'today_bench');
    assert.strictEqual(lifts[0].updatedAt, 100);
    assert.strictEqual(lifts[0].sleepQuality, 6);
    assert.strictEqual(lifts[0].exercises.length, 2);
    assert.strictEqual(lifts[0].exercises[0].sets.length, 2);
    assert.strictEqual(lifts[0].exercises[0].sets[0].weight, 55);
    assert.strictEqual(lifts[0].exercises[1].kind, 'Dumbbell Row');
    const all = storedLifts(storage, 'default');
    assert.ok(all.some(w => w.id === 'yesterday' && w.exercises[0].kind === 'Squat'));
    assert.ok(all.some(w => w.id === 'ride_today' && w.type === 'ride'));
    assert.strictEqual(storage.getItem(Session.draftKey('default')), null);

    const third = Session.commit(storage, 'default', {
        id: again.record.id,
        date: TODAY,
        time: '18:20',
        sleepQuality: 6,
        stressLevel: 5,
        bodyWeight: 181,
        muscleSoreness: 4,
        sick: 'no',
        injured: 'no',
        duration: 1000,
        exercises: [{ kind: 'Dumbbell Bench Press', sets: [{ weight: 60, reps: 5 }] }]
    }, { today: TODAY, now: 200 });

    assert.strictEqual(todayLifts(storage).length, 1);
    assert.strictEqual(third.record.id, 'today_bench');
    assert.strictEqual(third.record.exercises.length, 1);
    assert.strictEqual(third.record.exercises[0].sets[0].weight, 60);
});

test('extra same-day lifts collapse onto the resumed id', () => {
    const storage = memoryStorage({
        workouts: JSON.stringify([
            lift(TODAY, 'Dumbbell Bench Press', 'early', { updatedAt: 1 }),
            lift(TODAY, 'Dumbbell Row', 'late', { updatedAt: 9 })
        ])
    });
    const decision = Session.resumeFor(storage, 'default', TODAY);
    assert.strictEqual(decision.savedId, 'late');

    const result = Session.commit(storage, 'default', {
        id: decision.savedId,
        date: TODAY,
        time: '18:00',
        sleepQuality: 7,
        stressLevel: 4,
        bodyWeight: 180,
        muscleSoreness: 3,
        sick: 'no',
        injured: 'no',
        duration: 600,
        exercises: [
            { kind: 'Dumbbell Bench Press', sets: [{ weight: 50, reps: 8 }] },
            { kind: 'Dumbbell Row', sets: [{ weight: 45, reps: 10 }] }
        ]
    }, { today: TODAY, now: 30 });

    assert.strictEqual(todayLifts(storage).length, 1);
    assert.strictEqual(result.record.id, 'late');
    assert.strictEqual(result.removed.map(w => w.id).join(','), 'early');
    const stones = JSON.parse(storage.getItem('workouts_tombstones'));
    assert.strictEqual(stones.length, 1);
    assert.strictEqual(stones[0].id, 'early');
    assert.strictEqual(stones[0].deleted, true);
});

test('next day starts fresh and drops yesterday\'s draft', () => {
    const storage = memoryStorage({
        workouts: JSON.stringify([lift(YESTERDAY, 'Squat', 'yesterday', { updatedAt: 4 })])
    });
    Session.writeDraft(storage, 'default', {
        date: YESTERDAY,
        savedId: 'yesterday',
        updatedAt: 99,
        form: { date: YESTERDAY, exercises: [{ kind: 'Squat', sets: [{ weight: 200, reps: 5 }] }] }
    });

    const decision = Session.resumeFor(storage, 'default', TODAY);

    assert.strictEqual(decision.source, null);
    assert.strictEqual(decision.form, null);
    assert.strictEqual(storage.getItem(Session.draftKey('default')), null);
    assert.strictEqual(storedLifts(storage, 'default')[0].id, 'yesterday');
});

test('saving a previous day appends and does not reopen or replace today', () => {
    const storage = memoryStorage({
        workouts: JSON.stringify([lift(TODAY, 'Dumbbell Bench Press', 'today_bench', { updatedAt: 10 })])
    });
    const result = Session.commit(storage, 'default', {
        id: 'today_bench',
        date: YESTERDAY,
        time: '12:00',
        sleepQuality: 7,
        stressLevel: 4,
        bodyWeight: null,
        muscleSoreness: 3,
        sick: 'no',
        injured: 'no',
        duration: 0,
        exercises: [{ kind: 'Squat', sets: [{ weight: 185, reps: 5 }] }]
    }, { today: TODAY, now: 40 });

    assert.notStrictEqual(result.record.id, 'today_bench');
    assert.strictEqual(result.record.date, YESTERDAY);
    const all = storedLifts(storage, 'default');
    assert.strictEqual(all.length, 2);
    assert.strictEqual(all.find(w => w.id === 'today_bench').exercises[0].kind, 'Dumbbell Bench Press');
    const openedToday = Session.resumeFor(storage, 'default', TODAY);
    assert.strictEqual(openedToday.savedId, 'today_bench');
    assert.strictEqual(openedToday.form.exercises[0].kind, 'Dumbbell Bench Press');
});

test('profile isolation: another lifter\'s today is invisible and untouched', () => {
    const mine = lift(TODAY, 'Dumbbell Bench Press', 'nick_today', { updatedAt: 3 });
    const theirs = lift(TODAY, 'Squat', 'other_today', { updatedAt: 8, exercises: [{ kind: 'Squat', sets: [{ weight: 225, reps: 5 }] }] });
    const storage = memoryStorage({
        workouts: JSON.stringify([mine]),
        lifter2_workouts: JSON.stringify([theirs])
    });

    const nick = Session.resumeFor(storage, 'default', TODAY);
    const other = Session.resumeFor(storage, 'lifter2', TODAY);
    assert.strictEqual(nick.savedId, 'nick_today');
    assert.strictEqual(nick.form.exercises[0].kind, 'Dumbbell Bench Press');
    assert.strictEqual(other.savedId, 'other_today');
    assert.strictEqual(other.form.exercises[0].kind, 'Squat');

    Session.writeDraft(storage, 'lifter2', {
        date: TODAY,
        savedId: 'other_today',
        updatedAt: 50,
        form: { date: TODAY, exercises: [{ kind: 'Front Squat', sets: [{ weight: 185, reps: 3 }] }] }
    });
    assert.strictEqual(Session.resumeFor(storage, 'default', TODAY).source, 'saved');
    assert.strictEqual(Session.resumeFor(storage, 'lifter2', TODAY).source, 'draft');

    Session.commit(storage, 'default', {
        id: 'nick_today',
        date: TODAY,
        time: '18:00',
        sleepQuality: 7,
        stressLevel: 4,
        bodyWeight: 180,
        muscleSoreness: 3,
        sick: 'no',
        injured: 'no',
        duration: 600,
        exercises: [{ kind: 'Dumbbell Bench Press', sets: [{ weight: 60, reps: 8 }] }]
    }, { today: TODAY, now: 60 });

    const otherStored = JSON.parse(storage.getItem('lifter2_workouts'));
    assert.strictEqual(otherStored.length, 1);
    assert.strictEqual(otherStored[0].id, 'other_today');
    assert.strictEqual(otherStored[0].exercises[0].kind, 'Squat');
    assert.strictEqual(storage.getItem('lifter2_liftlogicDraft') == null, false);
    assert.strictEqual(todayLifts(storage, 'default').length, 1);
    assert.strictEqual(todayLifts(storage, 'default')[0].exercises[0].sets[0].weight, 60);
});

test('explicit Load is blocked by typed exercises and allowed over a resume', () => {
    assert.strictEqual(Session.loadIsBlocked(false, false), false);
    assert.strictEqual(Session.loadIsBlocked(true, false), true);
    assert.strictEqual(Session.loadIsBlocked(true, true), false);
});

test('tracker wires resume, same-id save, and the service worker caches the module', () => {
    const html = fs.readFileSync(path.join(root, 'tracker.html'), 'utf8');
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.match(html, /js\/data\/workout-session\.js/);
    assert.match(html, /id="resumeNote"/);
    assert.match(html, /LiftLogicSession\.resumeFor/);
    assert.match(html, /LiftLogicSession\.commit/);
    assert.match(html, /LiftLogicSession\.loadIsBlocked/);
    assert.match(sw, /const CACHE_NAME = 'liftlogic-v24'/);
    assert.match(sw, /\.\/js\/data\/workout-session\.js/);
});
