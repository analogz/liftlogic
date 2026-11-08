/**
 * Default schedule uses dumbbell substitutes for the barbell slots.
 * Saved workouts are a different store and must not be relabeled.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = {
    console,
    module: { exports: {} },
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
load('js/schedule-data.js');

const schedule = sandbox.module.exports.SCHEDULE_DATA;
const DB = sandbox.ExerciseDB;
const Progress = sandbox.LiftLogicProgress;

const REPLACEMENTS = [
    ['Monday', 'Barbell Bench Press', 'Dumbbell Bench Press', '4 × 6-8'],
    ['Tuesday', 'Barbell Bent-Over Row', 'Dumbbell Row', '3 × 8-10'],
    ['Tuesday', 'Barbell Curl', 'Dumbbell Curl', '3 × 8-10'],
    ['Wednesday', 'Barbell Overhead Press', 'Dumbbell Shoulder Press', '4 × 6-8'],
    ['Friday', 'Incline Barbell Press', 'Incline Dumbbell Press', '4 × 6-8']
];

function day(name) {
    return schedule.days.find(d => d.name === name);
}

function memoryStorage(initial) {
    const data = Object.assign({}, initial);
    return {
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
        },
        setItem(key, value) { data[key] = String(value); },
        removeItem(key) { delete data[key]; }
    };
}

test('default week replaces only the five barbell slots', () => {
    assert.strictEqual(schedule.title, '5-Day Upper Body Split');
    assert.deepStrictEqual(Array.from(schedule.days.map(d => d.name)), [
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    ]);
    assert.deepStrictEqual(Array.from(schedule.days.map(d => d.focus)), [
        'Chest & Triceps',
        'Pull A — Back & Biceps',
        'Shoulders & Abs',
        'Pull B — Back & Biceps',
        'Chest, Shoulders & Abs',
        'Cycling / Active Recovery',
        'Rest / Recovery'
    ]);

    const names = schedule.days.flatMap(d => (d.exercises || []).map(ex => ex.name));
    REPLACEMENTS.forEach(([dayName, before, after, sets]) => {
        const match = day(dayName).exercises.find(ex => ex.name === after && ex.sets === sets);
        assert.ok(match, `${dayName} should prescribe ${after} ${sets}`);
        assert.ok(!day(dayName).exercises.some(ex => ex.name === before), `${before} should leave ${dayName}`);
    });
    assert.ok(!names.some(name => /barbell/i.test(name)), `barbell name still in default week: ${names.join(', ')}`);

    assert.deepStrictEqual(Array.from(day('Monday').exercises.map(ex => `${ex.name}|${ex.sets}`)), [
        'Dumbbell Bench Press|4 × 6-8',
        'Incline Dumbbell Press|3 × 8-10',
        'Cable Chest Fly|3 × 12-15',
        'Cable Tricep Pushdown|3 × 10-12',
        'Hanging Leg Raises|3 × 10-15'
    ]);
    assert.deepStrictEqual(Array.from(day('Tuesday').exercises.map(ex => `${ex.name}|${ex.sets}`)), [
        'Weighted Pull-Ups|4 × 6-8',
        'Dumbbell Row|3 × 8-10',
        'Cable Face Pulls|3 × 15-20',
        'Dumbbell Curl|3 × 8-10',
        'Cable Crunch|3 × 15-20'
    ]);
    assert.deepStrictEqual(Array.from(day('Thursday').exercises.map(ex => ex.name)), [
        'Lat Pulldown',
        'Seated Cable Row',
        'Cable Face Pulls',
        'Incline Dumbbell Curl',
        'Pallof Press'
    ]);
    assert.strictEqual(day('Thursday').exercises[4].sets, '3 × 12-15 / side');
    assert.strictEqual(day('Saturday').isRest, true);
    assert.strictEqual(day('Sunday').isRest, true);
});

test('replacements are canonical catalog exercises and do not alias to the barbell', () => {
    REPLACEMENTS.forEach(([, before, after]) => {
        assert.strictEqual(DB.resolveName(after), after, `${after} should be the catalog name`);
        const info = DB.getExerciseInfo(after);
        assert.strictEqual(info.builtIn, true);
        assert.ok(!/barbell/i.test(info.equipment), `${after} equipment is ${info.equipment}`);
        assert.notStrictEqual(DB.resolveName(before), after);
        assert.strictEqual(Progress.sameExercise(before, after), false);
        assert.ok(DB.hasExercise(before), `${before} must stay in the library`);
    });

    // Aliases a lifter might type still land on the scheduled movement.
    assert.strictEqual(DB.resolveName('Dumbbell Bench Press - Flat'), 'Dumbbell Bench Press');
    assert.strictEqual(DB.resolveName('Dumbbell Rows - Bent Over'), 'Dumbbell Row');
    assert.strictEqual(DB.resolveName('Dumbbell Overhead Press'), 'Dumbbell Shoulder Press');
    assert.strictEqual(DB.resolveName('Dumbbell Bicep Curls - Standing'), 'Dumbbell Curl');
    assert.strictEqual(DB.resolveName('Incline Dumbbell Bench Press'), 'Incline Dumbbell Press');

    // Two-hand bent-over row, not the unilateral or chest-supported variant.
    assert.notStrictEqual(DB.resolveName('Dumbbell Row'), 'One-Arm Dumbbell Row');
    assert.strictEqual(Progress.sameExercise('Dumbbell Row', 'One-Arm Dumbbell Row'), false);
    // Tuesday curl stays the standard curl; Thursday keeps the incline variation.
    assert.strictEqual(Progress.sameExercise('Dumbbell Curl', 'Incline Dumbbell Curl'), false);
});

test('a saved barbell log is not retitled or used as the dumbbell suggestion', () => {
    const workouts = [{
        id: 'kept',
        date: '2024-08-01',
        exercises: [{
            kind: 'Barbell Bench Press',
            sets: [{ weight: 185, reps: 5 }, { weight: 185, reps: 5 }]
        }, {
            kind: 'Incline Barbell Press',
            sets: [{ weight: 135, reps: 6 }]
        }]
    }];
    const storage = memoryStorage({
        workouts: JSON.stringify(workouts),
        customSchedule: JSON.stringify({ title: 'My own week', exercises: ['Barbell Curl'] })
    });

    const dumbbell = Progress.buildHistory('Dumbbell Bench Press', { userId: 'default', storage });
    assert.strictEqual(dumbbell.points.length, 0);
    assert.match(dumbbell.summary, /No saved history/);

    const barbell = Progress.buildHistory('Barbell Bench Press', { userId: 'default', storage });
    assert.strictEqual(barbell.points.length, 1);
    assert.strictEqual(barbell.points[0].weight, 185);
    assert.strictEqual(barbell.points[0].reps, 5);

    const incline = Progress.buildHistory('Incline Dumbbell Press', { userId: 'default', storage });
    assert.strictEqual(incline.points.length, 0);

    // Reading the schedule must not rewrite stored logs or an unrelated custom blob.
    assert.strictEqual(storage.getItem('workouts'), JSON.stringify(workouts));
    assert.strictEqual(storage.getItem('customSchedule'), JSON.stringify({ title: 'My own week', exercises: ['Barbell Curl'] }));
});

test('service worker cache moved past the previous default schedule', () => {
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.match(sw, /const CACHE_NAME = 'liftlogic-v19'/);
    assert.doesNotMatch(sw, /liftlogic-v18/);
    assert.match(sw, /\.\/js\/schedule-data\.js/);
    assert.match(sw, /\.\/css\/glass\.css/);
    assert.match(sw, /\.\/assets\/bg\/forest-bg-desktop\.webp/);
    assert.doesNotMatch(sw, /village-bg/);
    assert.doesNotMatch(sw, /liftlogic-v14/);
});
