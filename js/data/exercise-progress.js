/**
 * All-time progress for one exercise, shown on the tracker card.
 *
 * Plotted value is the best single set of that day, not the sum of the session:
 *   external load:  logged weight (lb) × reps
 *   bodyweight:     most reps in one set (body mass is never invented)
 *   added load:     extra logged weight × reps, body mass not included
 *
 * Saved workouts for the active profile only. Tombstones, rides, unsaved
 * form input, and other profiles are ignored. No rolling date window.
 *
 * Weight × reps is work. It is not a strength score: more reps at a lighter
 * weight can outrank a heavier set. A separate Epley estimate says when
 * those two stories disagree.
 */
(function (root) {
    'use strict';

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const VB_W = 320;
    const VB_H = 150;
    const PAD_L = 46;
    const PAD_R = 12;
    const PAD_T = 16;
    const PAD_B = 28;

    const mounts = new Map();

    function db() {
        return root.ExerciseDB || null;
    }

    function fallbackNormalize(name) {
        if (!name || typeof name !== 'string') return '';
        return name.toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim()
            .split(' ')
            .map(w => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) ? w.slice(0, -1) : w)
            .join(' ');
    }

    function normalize(name) {
        const catalog = db();
        if (catalog && typeof catalog.normalizeName === 'function') return catalog.normalizeName(name);
        return fallbackNormalize(name);
    }

    /**
     * Catalog exercises share one key across aliases ("Incline Dumbbell Bench Press"
     * and "Incline Dumbbell Press"). Custom names match only on the same normalized
     * spelling — never by substring, so "Row" does not absorb "Barbell Row".
     */
    function identityKey(name) {
        const raw = typeof name === 'string' ? name.trim() : '';
        if (!raw) return '';
        const catalog = db();
        if (catalog && typeof catalog.resolveName === 'function') {
            const resolved = catalog.resolveName(raw);
            if (resolved) return 'cat:' + normalize(resolved);
        }
        const norm = normalize(raw);
        return norm ? 'raw:' + norm : '';
    }

    function sameExercise(a, b) {
        const ka = identityKey(a);
        const kb = identityKey(b);
        return !!ka && ka === kb;
    }

    function storageKeyFor(userId) {
        const id = userId == null || userId === '' ? 'default' : String(userId);
        return id === 'default' ? 'workouts' : `${id}_workouts`;
    }

    function isBodyMassExercise(name) {
        const catalog = db();
        if (!catalog || typeof catalog.getExerciseInfo !== 'function') {
            const n = ` ${normalize(name)} `;
            return / (pull up|chin up|push up|dip|muscle up|inverted row|hanging leg raise|hanging knee raise|nordic curl) /.test(n);
        }
        const info = catalog.getExerciseInfo(name) || {};
        const equip = String(info.equipment || '').toLowerCase();
        const station = info.station || info.suggestedStation || '';
        if (equip.includes('bodyweight')) return true;
        return station === 'bodyweight' || station === 'pullup' || station === 'dip';
    }

    function field(obj, names) {
        if (!obj || typeof obj !== 'object') return undefined;
        for (let i = 0; i < names.length; i++) {
            const v = obj[names[i]];
            if (v != null && v !== '') return v;
        }
        const lower = {};
        Object.keys(obj).forEach(k => { lower[k.toLowerCase()] = obj[k]; });
        for (let i = 0; i < names.length; i++) {
            const v = lower[names[i]];
            if (v != null && v !== '') return v;
        }
        return undefined;
    }

    function parseNumber(value) {
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        if (typeof value !== 'string') return null;
        const s = value.trim().replace(/,/g, '');
        if (!s) return null;
        // Reject kilograms so they are not plotted as pounds. Allow a trailing lb unit.
        const m = s.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(lb|lbs|kg|kgs)?$/i);
        if (!m) return null;
        if (m[2] && m[2].toLowerCase().startsWith('kg')) return null;
        const n = Number(m[1]);
        return Number.isFinite(n) ? n : null;
    }

    function parseReps(value) {
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        if (typeof value !== 'string') return null;
        const s = value.trim().replace(/,/g, '');
        const m = s.match(/^(\d+(?:\.\d+)?)(?:\s*reps?)?$/i);
        if (!m) return null;
        const n = Number(m[1]);
        return Number.isFinite(n) ? n : null;
    }

    function parseSetString(value) {
        const m = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(?:lb|lbs)?\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*reps?)?$/i);
        if (!m) return null;
        return { weight: Number(m[1]), reps: Number(m[2]) };
    }

    /**
     * New logs store sets as [{weight, reps}]. Older logs store one weight/reps
     * on the exercise and a numeric set count. The count is not expanded —
     * best-set work uses the one logged set, it does not multiply by the count.
     */
    function extractRawSets(exercise) {
        if (!exercise || typeof exercise !== 'object') return [];
        if (Array.isArray(exercise.sets)) {
            const fromArray = [];
            exercise.sets.forEach(item => {
                if (typeof item === 'string') {
                    const parsed = parseSetString(item);
                    if (parsed) fromArray.push(parsed);
                    return;
                }
                if (item && typeof item === 'object') fromArray.push(item);
            });
            // Ignore a sets array that doesn't actually contain a set, so a
            // legacy weight/reps pair on the exercise can still be read.
            if (fromArray.some(item => normalizeSet(item))) return fromArray;
        }
        const weight = field(exercise, ['weight', 'load', 'lbs']);
        const reps = field(exercise, ['reps', 'rep', 'repetitions']);
        if (weight != null || reps != null) return [{ weight: weight, reps: reps }];
        return [];
    }

    function normalizeSet(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const reps = parseReps(field(raw, ['reps', 'rep', 'repetitions']));
        if (reps == null || reps <= 0) return null;
        const weight = parseNumber(field(raw, ['weight', 'load', 'lbs']));
        if (weight == null) return { weight: null, reps: reps };
        if (weight < 0) return null;
        return { weight: weight, reps: reps };
    }

    function canonicalDate(value) {
        if (value == null || value === '') return null;
        const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(value).trim());
        if (!m) return null;
        const y = +m[1];
        const mo = +m[2];
        const d = +m[3];
        if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
        const dt = new Date(y, mo - 1, d);
        if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
        const key = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        return { key: key, time: dt.getTime() };
    }

    function workoutDate(workout) {
        if (!workout || typeof workout !== 'object') return null;
        const direct = workout.date || (workout.dailyInfo && (workout.dailyInfo.currentDate || workout.dailyInfo.date));
        return canonicalDate(direct);
    }

    function readWorkouts(storage, key) {
        if (!storage || typeof storage.getItem !== 'function') return [];
        let raw;
        try { raw = storage.getItem(key); } catch (e) { return []; }
        if (raw == null || raw === '') return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function resolveUserId(options) {
        if (options && options.userId != null && options.userId !== '') return String(options.userId);
        if (options && options.storage && typeof options.storage.getItem === 'function') {
            try {
                const saved = options.storage.getItem('currentUser');
                if (saved) return String(saved);
            } catch (e) { /* use default */ }
        }
        return 'default';
    }

    function fmtNum(n) {
        if (!Number.isFinite(n)) return '—';
        const rounded = Math.round(n * 10) / 10;
        const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
        const parts = text.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
    }

    function fmtE1rm(n) {
        if (!Number.isFinite(n)) return '—';
        return fmtNum(Math.round(n));
    }

    function epley(weight, reps) {
        if (!(weight > 0) || !(reps > 0)) return null;
        if (reps === 1) return weight;
        return weight * (1 + reps / 30);
    }

    function formatLong(iso) {
        const y = +iso.slice(0, 4);
        const m = +iso.slice(5, 7);
        const d = +iso.slice(8, 10);
        return `${MONTHS[m - 1]} ${d}, ${y}`;
    }

    function formatAxis(iso, withYear) {
        const y = +iso.slice(0, 4);
        const m = +iso.slice(5, 7);
        const d = +iso.slice(8, 10);
        return withYear ? `${MONTHS[m - 1]} ${d}, ${y}` : `${MONTHS[m - 1]} ${d}`;
    }

    function setLabel(point, mode) {
        if (mode === 'reps') return `bodyweight × ${fmtNum(point.reps)} reps`;
        if (mode === 'added') return `${fmtNum(point.weight)} lb added × ${fmtNum(point.reps)}`;
        return `${fmtNum(point.weight)} lb × ${fmtNum(point.reps)}`;
    }

    function valueLabel(point, mode) {
        if (mode === 'reps') return `${fmtNum(point.value)} reps`;
        return `${fmtNum(point.value)} lb·reps`;
    }

    function better(current, next) {
        if (!current) return next;
        if (next.value > current.value + 1e-9) return next;
        if (Math.abs(next.value - current.value) <= 1e-9) {
            if (next.weight > current.weight + 1e-9) return next;
            if (Math.abs(next.weight - current.weight) <= 1e-9 && next.reps > current.reps) return next;
        }
        return current;
    }

    function yDomain(values) {
        let min = Math.min.apply(null, values);
        let max = Math.max.apply(null, values);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, zoomed: false };
        if (min === max) {
            const pad = min === 0 ? 1 : Math.abs(min) * 0.2;
            const yMin = Math.max(0, min - pad);
            return { min: yMin, max: max + pad, zoomed: yMin > 0 };
        }
        const pad = (max - min) * 0.2;
        const yMin = Math.max(0, min - pad);
        return { min: yMin, max: max + pad, zoomed: yMin > 0 };
    }

    function layoutChart(points) {
        if (!points.length) return null;
        const domain = yDomain(points.map(p => p.value));
        const plotW = VB_W - PAD_L - PAD_R;
        const plotH = VB_H - PAD_T - PAD_B;
        const t0 = points[0].time;
        const t1 = points[points.length - 1].time;
        const span = domain.max - domain.min || 1;
        const coords = points.map((p, i) => {
            const x = t1 === t0 ? PAD_L + plotW / 2 : PAD_L + ((p.time - t0) / (t1 - t0)) * plotW;
            const y = PAD_T + (1 - (p.value - domain.min) / span) * plotH;
            return { i: i, x: x, y: y };
        });
        return {
            width: VB_W,
            height: VB_H,
            zoomed: domain.zoomed && points.length > 1,
            domainMin: domain.min,
            domainMax: domain.max,
            coords: coords
        };
    }

    function metricCopy(mode) {
        if (mode === 'reps') {
            return {
                metricLabel: 'Best set · bodyweight reps',
                unit: 'reps',
                note: 'Each point is the most reps in a single set that day. No external weight was logged. Body mass is not stored on the set and is not invented here, so this is not total-bodyweight volume or a strength score.'
            };
        }
        if (mode === 'added') {
            return {
                metricLabel: 'Best set · added weight × reps',
                unit: 'lb·reps',
                note: 'Each point is that day’s best set of added load × reps (the extra weight you logged). Body mass is not included, so this is not total-bodyweight strength. Bodyweight-only sessions stay off the line so they are not drawn as zero.'
            };
        }
        return {
            metricLabel: 'Best set · weight × reps',
            unit: 'lb·reps',
            note: 'Each point is one day’s best set: logged weight × reps. Extra sets do not raise the line. Weight × reps is work, not a direct measure of strength — more reps at a lighter weight can outrank a heavier set.'
        };
    }

    function deltaPhrase(latest, prev, unit) {
        const d = latest.value - prev.value;
        const when = formatLong(prev.date);
        const prevSet = setLabel(prev, prev.mode || latest.mode);
        if (Math.abs(d) < 0.05) return `same best-set work as ${when} (${prevSet})`;
        if (d > 0) return `up ${fmtNum(d)} ${unit} from ${when} (${prevSet})`;
        return `down ${fmtNum(-d)} ${unit} from ${when} (${prevSet})`;
    }

    function strengthContext(points, mode) {
        const latest = points[points.length - 1];
        const prev = points.length > 1 ? points[points.length - 2] : null;
        if (mode === 'reps') {
            if (!prev) {
                return 'Bodyweight reps only. More reps is more work, not a strength score. Body mass was not added.';
            }
            if (latest.reps === prev.reps) {
                return 'Same best-set reps as the previous session. More reps would be more work at bodyweight, not a strength score.';
            }
            return `Reps went from ${fmtNum(prev.reps)} to ${fmtNum(latest.reps)}. More reps is more work at bodyweight, not a strength score.`;
        }
        const eNow = epley(latest.weight, latest.reps);
        if (!prev) {
            return `Estimated 1RM of this set (Epley) is ${fmtE1rm(eNow)} lb. That formula is a rough cue only. Weight × reps is work, not a direct measure of strength.`;
        }
        const ePrev = epley(prev.weight, prev.reps);
        const workUp = latest.value > prev.value + 0.05;
        const workDown = latest.value < prev.value - 0.05;
        const strengthUp = eNow > ePrev + 0.5;
        const strengthDown = eNow < ePrev - 0.5;
        const repsClause = latest.reps !== prev.reps
            ? `Reps went from ${fmtNum(prev.reps)} to ${fmtNum(latest.reps)}. `
            : '';
        if (workUp && strengthDown) {
            return `${repsClause}Best-set work is up, but estimated strength of that set is down (Epley ${fmtE1rm(eNow)} lb vs ${fmtE1rm(ePrev)} lb last time). Extra reps are carrying the number. Estimated 1RM is a rough cue, not the chart.`;
        }
        if (workDown && strengthUp) {
            return `${repsClause}Best-set work is down, but estimated strength of that set is up (Epley ${fmtE1rm(eNow)} lb vs ${fmtE1rm(ePrev)} lb last time). A heavier set can be stronger even when weight × reps falls.`;
        }
        if (strengthUp) {
            return `${repsClause}Estimated 1RM of the latest set (Epley) is ${fmtE1rm(eNow)} lb, up from ${fmtE1rm(ePrev)} lb. That is a rough strength cue. The chart itself is weight × reps, which can move differently from strength when reps change.`;
        }
        if (strengthDown) {
            return `${repsClause}Estimated 1RM of the latest set (Epley) is ${fmtE1rm(eNow)} lb, down from ${fmtE1rm(ePrev)} lb. Weight × reps is work, not a direct measure of strength.`;
        }
        return `${repsClause}Estimated 1RM of the latest set (Epley) is ${fmtE1rm(eNow)} lb. Weight × reps is work, not a direct measure of strength.`;
    }

    function summarize(model) {
        const copy = model.mode === 'none' ? null : metricCopy(model.mode);
        model.metricLabel = copy ? copy.metricLabel : 'All-time progress';
        model.unit = copy ? copy.unit : '';
        model.note = copy ? copy.note : '';
        if (model.chart && model.chart.zoomed) {
            model.note += ' The vertical axis is zoomed to your range, not drawn from zero, so small changes stay visible.';
        }
        const omitted = model.omittedBodyweightSessions || 0;
        const omittedText = omitted
            ? ` ${omitted} bodyweight-only session${omitted === 1 ? ' is' : 's are'} not on the line.`
            : '';

        if (model.status === 'empty') {
            model.summary = 'No saved history for this exercise on this profile.';
            model.context = '';
            return;
        }
        if (model.status === 'incomplete') {
            model.summary = model.bodyMass
                ? 'This exercise is in your saved workouts, but no set has a rep count that can be plotted.'
                : 'This exercise is in your saved workouts, but no set has both a weight above 0 and reps. Incomplete sets are skipped. Body mass is not assumed.';
            model.context = '';
            return;
        }

        const points = model.points;
        const latest = points[points.length - 1];
        const best = points.reduce((b, p) => (p.value > b.value ? p : b), points[0]);
        const latestText = `${setLabel(latest, model.mode)} (${valueLabel(latest, model.mode)})`;
        if (points.length === 1) {
            model.summary = `One saved session (${formatLong(latest.date)}). Best set ${latestText}. Log it again to see a trend.${omittedText}`;
        } else {
            const prev = points[points.length - 2];
            const bestText = (best === latest)
                ? 'All-time best by this metric is this session.'
                : `All-time best by this metric is ${setLabel(best, model.mode)} (${valueLabel(best, model.mode)}) on ${formatLong(best.date)}.`;
            model.summary = `${points.length} sessions, ${formatLong(points[0].date)} – ${formatLong(latest.date)}. Latest best set ${latestText}, ${deltaPhrase(latest, prev, model.unit)}. ${bestText}${omittedText}`;
        }
        model.context = strengthContext(points, model.mode);
    }

    function readoutFor(point, prev, mode) {
        let text = `${formatLong(point.date)} · ${setLabel(point, mode)}`;
        if (mode !== 'reps') text += ` · ${valueLabel(point, mode)}`;
        if (prev && prev.reps !== point.reps) {
            text += ` · reps were ${fmtNum(prev.reps)} last time`;
        }
        return text;
    }

    function emptyModel(query, userId) {
        return {
            query: query || '',
            displayName: query || '',
            userId: userId,
            storageKey: storageKeyFor(userId),
            bodyMass: false,
            mode: 'none',
            status: 'empty',
            points: [],
            omittedBodyweightSessions: 0,
            matchedWorkouts: 0,
            metricLabel: 'All-time progress',
            unit: '',
            note: '',
            summary: 'No saved history for this exercise on this profile.',
            context: '',
            readouts: [],
            chart: null
        };
    }

    function buildHistory(exerciseName, options) {
        const query = typeof exerciseName === 'string' ? exerciseName.trim() : '';
        const userId = resolveUserId(options || {});
        if (!query) return emptyModel('', userId);

        const storage = options && options.storage
            ? options.storage
            : (typeof localStorage !== 'undefined' ? localStorage : null);
        const key = storageKeyFor(userId);
        const workouts = readWorkouts(storage, key);
        const bodyMass = isBodyMassExercise(query);
        const byDate = new Map();
        let matchedWorkouts = 0;

        workouts.forEach(workout => {
            if (!workout || typeof workout !== 'object') return;
            if (workout.deleted === true) return;
            if (workout.type === 'ride') return;
            const date = workoutDate(workout);
            if (!date) return;
            if (!Array.isArray(workout.exercises)) return;

            const bucketSets = [];
            workout.exercises.forEach(ex => {
                if (!ex || typeof ex !== 'object') return;
                const stored = typeof ex.kind === 'string' ? ex.kind : (typeof ex.name === 'string' ? ex.name : '');
                if (!sameExercise(query, stored)) return;
                extractRawSets(ex).forEach(raw => {
                    const set = normalizeSet(raw);
                    if (set) bucketSets.push(set);
                });
            });
            if (!bucketSets.length) {
                // Matching name with no parseable sets still counts as "in history"
                // only when the exercise entry itself was present.
                const named = workout.exercises.some(ex => {
                    if (!ex) return false;
                    const stored = typeof ex.kind === 'string' ? ex.kind : (typeof ex.name === 'string' ? ex.name : '');
                    return sameExercise(query, stored);
                });
                if (!named) return;
            }
            matchedWorkouts += 1;
            if (!byDate.has(date.key)) byDate.set(date.key, { date: date.key, time: date.time, sets: [] });
            const bucket = byDate.get(date.key);
            bucket.sets.push.apply(bucket.sets, bucketSets);
        });

        const dates = Array.from(byDate.values()).sort((a, b) => a.time - b.time);
        const allSets = [];
        dates.forEach(d => allSets.push.apply(allSets, d.sets));

        let mode = 'none';
        if (bodyMass) {
            if (allSets.some(s => s.weight > 0 && s.reps > 0)) mode = 'added';
            else if (allSets.some(s => s.reps > 0)) mode = 'reps';
        } else if (allSets.some(s => s.weight > 0 && s.reps > 0)) {
            mode = 'load';
        }

        const points = [];
        let omitted = 0;
        if (mode !== 'none') {
            dates.forEach(day => {
                let best = null;
                day.sets.forEach(set => {
                    let value = null;
                    let weight = set.weight;
                    if (mode === 'reps') {
                        if (!(set.reps > 0) || set.weight > 0) return;
                        value = set.reps;
                        weight = 0;
                    } else if (!(set.weight > 0) || !(set.reps > 0)) {
                        return;
                    } else {
                        value = set.weight * set.reps;
                    }
                    best = better(best, {
                        date: day.date,
                        time: day.time,
                        weight: weight,
                        reps: set.reps,
                        value: value,
                        e1rm: weight > 0 ? epley(weight, set.reps) : null,
                        mode: mode
                    });
                });
                if (best) points.push(best);
                else if (mode === 'added') omitted += 1;
            });
        }

        let status = 'empty';
        if (points.length === 1) status = 'single';
        else if (points.length > 1) status = 'trend';
        else if (matchedWorkouts > 0) status = 'incomplete';

        const catalog = db();
        const display = catalog && typeof catalog.getDisplayName === 'function'
            ? catalog.getDisplayName(query)
            : query;

        const model = {
            query: query,
            displayName: display,
            userId: userId,
            storageKey: key,
            bodyMass: bodyMass,
            mode: points.length ? mode : (status === 'incomplete' ? mode : 'none'),
            status: status,
            points: points,
            omittedBodyweightSessions: omitted,
            matchedWorkouts: matchedWorkouts,
            metricLabel: '',
            unit: '',
            note: '',
            summary: '',
            context: '',
            readouts: [],
            chart: null
        };

        // Incomplete added-mode with zero plotted points still explains itself as incomplete.
        if (!points.length) model.mode = 'none';
        model.chart = layoutChart(points);
        points.forEach((p, i) => {
            model.readouts.push(readoutFor(p, i > 0 ? points[i - 1] : null, mode));
        });
        summarize(model);
        return model;
    }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function chartAria(model) {
        if (model.mode === 'reps') {
            return 'All-time best-set chart of bodyweight reps. Body mass is not included. Left and right arrow keys read each saved session.';
        }
        if (model.mode === 'added') {
            return 'All-time chart of added weight times reps. Body mass is not included. Left and right arrow keys read each saved session.';
        }
        return 'All-time best-set chart. Left and right arrow keys read each saved session. The line is weight times reps, not a direct strength score.';
    }

    function svgMarkup(model) {
        const chart = model.chart;
        const points = model.points;
        if (!chart || !points.length) return '';
        const coords = chart.coords;
        const withYear = points[0].date.slice(0, 4) !== points[points.length - 1].date.slice(0, 4);
        const dataMin = Math.min.apply(null, points.map(p => p.value));
        const dataMax = Math.max.apply(null, points.map(p => p.value));
        const yOf = v => {
            const span = chart.domainMax - chart.domainMin || 1;
            return PAD_T + (1 - (v - chart.domainMin) / span) * (VB_H - PAD_T - PAD_B);
        };
        const last = coords.length - 1;
        const r = points.length > 24 ? 3.2 : 4.4;

        const line = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

        const yLabels = [];
        const maxY = yOf(dataMax);
        const minY = yOf(dataMin);
        yLabels.push(`<text x="${PAD_L - 6}" y="${(maxY + 3).toFixed(1)}" text-anchor="end" fill="#E8E8E8" font-size="10" font-family="ui-monospace, monospace">${esc(fmtNum(dataMax))}</text>`);
        if (Math.abs(minY - maxY) > 16 && dataMin !== dataMax) {
            yLabels.push(`<text x="${PAD_L - 6}" y="${(minY + 3).toFixed(1)}" text-anchor="end" fill="#E8E8E8" font-size="10" font-family="ui-monospace, monospace">${esc(fmtNum(dataMin))}</text>`);
        }

        const xLabels = [];
        xLabels.push(`<text x="${coords[0].x.toFixed(1)}" y="${VB_H - 8}" text-anchor="${coords.length === 1 ? 'middle' : 'start'}" fill="#E8E8E8" font-size="10" font-family="ui-sans-serif, sans-serif">${esc(formatAxis(points[0].date, withYear))}</text>`);
        if (coords.length > 1) {
            xLabels.push(`<text x="${coords[last].x.toFixed(1)}" y="${VB_H - 8}" text-anchor="end" fill="#E8E8E8" font-size="10" font-family="ui-sans-serif, sans-serif">${esc(formatAxis(points[last].date, withYear))}</text>`);
        }

        const dots = coords.map((c, i) => {
            const selected = i === last;
            return `<circle class="progress-dot${selected ? ' is-selected' : ''}" data-i="${i}" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${(selected ? r + 1.8 : r).toFixed(1)}" fill="${selected ? '#FFFFFF' : '#C8C8C8'}" stroke="${selected ? '#111111' : '#F4F4F4'}" stroke-width="${selected ? 2 : 1}"></circle>`;
        }).join('');

        const latestReadout = model.readouts[last] || '';
        return `<svg class="progress-svg" viewBox="0 0 ${VB_W} ${VB_H}" role="slider" tabindex="0" aria-valuemin="1" aria-valuemax="${points.length}" aria-valuenow="${points.length}" aria-valuetext="${esc(latestReadout)}" aria-label="${esc(chartAria(model))}">
            <line x1="${PAD_L}" y1="${maxY.toFixed(1)}" x2="${VB_W - PAD_R}" y2="${maxY.toFixed(1)}" stroke="rgba(255,255,255,0.28)" stroke-width="1"></line>
            ${dataMin !== dataMax ? `<line x1="${PAD_L}" y1="${minY.toFixed(1)}" x2="${VB_W - PAD_R}" y2="${minY.toFixed(1)}" stroke="rgba(255,255,255,0.28)" stroke-width="1"></line>` : ''}
            ${coords.length > 1 ? `<polyline points="${line}" fill="none" stroke="#F4F4F4" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>` : ''}
            ${dots}
            ${yLabels.join('')}
            ${xLabels.join('')}
        </svg>`;
    }

    function logMarkup(model) {
        if (model.points.length < 1) return '';
        const bestValue = model.points.reduce((m, p) => Math.max(m, p.value), 0);
        const items = model.points.slice().reverse().map(p => {
            const tags = [];
            if (p === model.points[model.points.length - 1]) tags.push('Latest');
            if (p.value === bestValue) tags.push('Best');
            const tagHtml = tags.map(t => `<span class="progress-tag">${t}</span>`).join(' ');
            return `<li class="${p.value === bestValue ? 'is-best' : ''}"><span class="progress-log-date">${esc(formatLong(p.date))}</span> ${esc(setLabel(p, model.mode))} <span class="progress-log-value">${esc(valueLabel(p, model.mode))}</span> ${tagHtml}</li>`;
        }).join('');
        const scrub = model.points.length > 1
            ? '<p class="progress-scrub">Tap the chart or use arrow keys to read each session.</p>'
            : '';
        return `${scrub}<details class="progress-log"><summary>All sessions (${model.points.length})</summary><ul>${items}</ul></details>`;
    }

    function toHtml(model) {
        if (!model || model.status === 'empty' || model.status === 'incomplete') {
            const summary = model && model.summary
                ? model.summary
                : 'No saved history for this exercise on this profile.';
            return `<div class="progress-card">
                <div class="progress-head"><span class="progress-kicker">All-time progress</span></div>
                <p class="progress-summary">${esc(summary)}</p>
            </div>`;
        }
        const readout = model.readouts.length ? model.readouts[model.readouts.length - 1] : '';
        return `<div class="progress-card">
            <div class="progress-head">
                <span class="progress-kicker">All-time progress</span>
                <span class="progress-metric">${esc(model.metricLabel)}</span>
            </div>
            <p class="progress-note">${esc(model.note)}</p>
            <div class="progress-chart">
                ${svgMarkup(model)}
                <div class="progress-readout" aria-live="polite">${esc(readout)}</div>
            </div>
            <p class="progress-summary">${esc(model.summary)}</p>
            ${model.context ? `<p class="progress-context">${esc(model.context)}</p>` : ''}
            ${logMarkup(model)}
        </div>`;
    }

    function selectIndex(rec, index) {
        const points = rec.model.points;
        if (!points.length) return;
        const i = Math.max(0, Math.min(points.length - 1, index));
        rec.index = i;
        const text = rec.model.readouts[i] || '';
        if (rec.readout) rec.readout.textContent = text;
        if (rec.svg) {
            rec.svg.setAttribute('aria-valuenow', String(i + 1));
            rec.svg.setAttribute('aria-valuetext', text);
            const dots = rec.svg.querySelectorAll ? rec.svg.querySelectorAll('.progress-dot') : [];
            for (let d = 0; d < dots.length; d++) {
                const dot = dots[d];
                const on = Number(dot.getAttribute('data-i')) === i;
                dot.setAttribute('fill', on ? '#FFFFFF' : '#C8C8C8');
                dot.setAttribute('stroke', on ? '#111111' : '#F4F4F4');
                dot.setAttribute('stroke-width', on ? '2' : '1');
                if (dot.classList) dot.classList.toggle('is-selected', on);
            }
        }
    }

    function indexFromClientX(rec, clientX) {
        const coords = rec.model.chart.coords;
        const rect = rec.svg.getBoundingClientRect();
        if (!rect || !rect.width) return coords.length - 1;
        const x = ((clientX - rect.left) / rect.width) * VB_W;
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i < coords.length; i++) {
            const d = Math.abs(coords[i].x - x);
            if (d < bestD) { bestD = d; best = i; }
        }
        return best;
    }

    function mount(container, model) {
        if (!container) return;
        unmount(container);
        container.hidden = false;
        container.innerHTML = toHtml(model);
        container.dataset.status = model.status;
        container.dataset.mode = model.mode || 'none';
        container.dataset.points = String(model.points.length);
        const svg = container.querySelector('.progress-svg');
        if (!svg || !model.chart) return;

        const rec = {
            model: model,
            svg: svg,
            readout: container.querySelector('.progress-readout'),
            index: model.points.length - 1
        };

        function onPointer(event) {
            if (event.pointerType === 'mouse' && event.type === 'pointermove' && event.buttons === 0) {
                selectIndex(rec, indexFromClientX(rec, event.clientX));
                return;
            }
            if (event.type === 'pointerdown' && svg.setPointerCapture) {
                try { svg.setPointerCapture(event.pointerId); } catch (e) { /* ignore */ }
            }
            selectIndex(rec, indexFromClientX(rec, event.clientX));
        }
        function onKey(event) {
            const key = event.key;
            if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
            event.preventDefault();
            if (key === 'Home') selectIndex(rec, 0);
            else if (key === 'End') selectIndex(rec, model.points.length - 1);
            else if (key === 'ArrowLeft') selectIndex(rec, rec.index - 1);
            else selectIndex(rec, rec.index + 1);
        }

        svg.addEventListener('pointerdown', onPointer);
        svg.addEventListener('pointermove', onPointer);
        svg.addEventListener('keydown', onKey);
        rec.cleanup = function () {
            svg.removeEventListener('pointerdown', onPointer);
            svg.removeEventListener('pointermove', onPointer);
            svg.removeEventListener('keydown', onKey);
        };
        mounts.set(container, rec);
        selectIndex(rec, rec.index);
    }

    function dropDetached() {
        Array.from(mounts.keys()).forEach(node => {
            if (!node || node.isConnected !== false) return;
            const rec = mounts.get(node);
            if (rec) {
                try { rec.cleanup(); } catch (e) { /* node already gone */ }
            }
            mounts.delete(node);
        });
    }

    function unmount(container) {
        const rec = container && mounts.get(container);
        if (rec) {
            rec.cleanup();
            mounts.delete(container);
        }
        dropDetached();
    }

    function clear(container) {
        if (!container) return;
        unmount(container);
        container.innerHTML = '';
        container.hidden = true;
        if (container.removeAttribute) {
            container.removeAttribute('data-status');
            container.removeAttribute('data-mode');
            container.removeAttribute('data-points');
        }
        if (container.dataset) {
            delete container.dataset.status;
            delete container.dataset.mode;
            delete container.dataset.points;
        }
    }

    function unmountAll() {
        Array.from(mounts.keys()).forEach(unmount);
    }

    function activeMounts() {
        dropDetached();
        return mounts.size;
    }

    const api = {
        storageKeyFor: storageKeyFor,
        identityKey: identityKey,
        sameExercise: sameExercise,
        isBodyMassExercise: isBodyMassExercise,
        extractRawSets: extractRawSets,
        buildHistory: buildHistory,
        toHtml: toHtml,
        mount: mount,
        unmount: unmount,
        clear: clear,
        unmountAll: unmountAll,
        dropDetached: dropDetached,
        activeMounts: activeMounts
    };

    root.LiftLogicProgress = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
