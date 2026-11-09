/**
 * One lifting workout per profile per local calendar day.
 *
 * The tracker used to push a new record on every save (`id = date_timestamp`)
 * and open a blank form, so leaving and coming back the same day started a
 * second session. This module reloads today's lift (or a newer unsaved draft)
 * and writes the form back onto that same id. Rides and other dates stay put.
 * A previous day's workout is never reopened.
 *
 * Drafts live in their own localStorage key and never enter the workouts
 * array, so stats ignore unsaved edits. They are cleared on save and dropped
 * when their date is no longer today.
 */
(function (global) {
    function storageKey(userId) {
        const id = userId || 'default';
        return id === 'default' ? 'workouts' : `${id}_workouts`;
    }

    function draftKey(userId) {
        const id = userId || 'default';
        return id === 'default' ? 'liftlogicDraft' : `${id}_liftlogicDraft`;
    }

    function recordDate(w) {
        if (!w) return '';
        if (w.date) return w.date;
        const info = w.dailyInfo;
        return (info && (info.currentDate || info.date)) || '';
    }

    function isRide(w) {
        return !!(w && w.type === 'ride');
    }

    function readList(storage, key) {
        try {
            const parsed = JSON.parse(storage.getItem(key) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function liftsOn(list, date) {
        return (list || []).filter(w => w && !w.deleted && !isRide(w) && recordDate(w) === date);
    }

    /** Newest updatedAt. Ties keep the later array entry. */
    function pickNewest(matches) {
        if (!matches.length) return null;
        let best = matches[0];
        let bestAt = Number(best.updatedAt) || 0;
        for (let i = 1; i < matches.length; i++) {
            const at = Number(matches[i].updatedAt) || 0;
            if (at >= bestAt) {
                best = matches[i];
                bestAt = at;
            }
        }
        return best;
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeExercise(exercise) {
        const kind = String((exercise && (exercise.kind || exercise.name)) || '').trim();
        let sets = Array.isArray(exercise && exercise.sets) ? exercise.sets : [];
        if (!sets.length && exercise && (exercise.weight != null || exercise.reps != null)) {
            sets = [{ weight: exercise.weight, reps: exercise.reps, rpe: null, rir: null }];
        }
        return {
            kind,
            sets: sets.map(set => ({
                weight: set && set.weight != null && set.weight !== '' ? set.weight : null,
                reps: set && set.reps != null && set.reps !== '' ? set.reps : null,
                rpe: set && set.rpe != null && set.rpe !== '' ? set.rpe : null,
                rir: set && set.rir != null && set.rir !== '' ? set.rir : null
            })),
            pump: exercise && exercise.pump != null && exercise.pump !== '' ? exercise.pump : null
        };
    }

    function normalizeForm(workout) {
        const info = (workout && workout.dailyInfo) || {};
        const pick = (key) => (workout && workout[key] != null ? workout[key] : info[key]);
        const exercises = ((workout && workout.exercises) || []).map(normalizeExercise).filter(ex => ex.kind || ex.sets.length);
        return {
            id: workout && workout.id || null,
            date: recordDate(workout),
            time: (workout && workout.time) || info.currentTime || info.time || '',
            sleepQuality: pick('sleepQuality'),
            stressLevel: pick('stressLevel'),
            bodyWeight: pick('bodyWeight') != null ? pick('bodyWeight') : null,
            muscleSoreness: pick('muscleSoreness'),
            sick: pick('sick') || 'no',
            injured: pick('injured') || 'no',
            exercises,
            duration: workout && workout.duration ? workout.duration : 0
        };
    }

    function hasContent(form) {
        const exercises = (form && form.exercises) || [];
        return exercises.some(exercise => {
            if (exercise && String(exercise.kind || exercise.name || '').trim()) return true;
            return ((exercise && exercise.sets) || []).some(set =>
                set && ((set.weight != null && set.weight !== '') || (set.reps != null && set.reps !== ''))
            );
        });
    }

    function readDraft(storage, userId) {
        try {
            const raw = storage.getItem(draftKey(userId));
            if (!raw) return null;
            const draft = JSON.parse(raw);
            if (!draft || typeof draft !== 'object' || !draft.form) return null;
            return draft;
        } catch (e) {
            return null;
        }
    }

    function writeDraft(storage, userId, draft) {
        storage.setItem(draftKey(userId), JSON.stringify(draft));
    }

    function clearDraft(storage, userId) {
        storage.removeItem(draftKey(userId));
    }

    /**
     * What the tracker should show for `today`.
     * A same-day draft newer than the saved lift wins (unsaved edits).
     * Anything from another date is ignored and a stale draft is removed.
     */
    function resumeFor(storage, userId, today) {
        const saved = pickNewest(liftsOn(readList(storage, storageKey(userId)), today));
        const savedAt = saved ? (Number(saved.updatedAt) || 0) : 0;
        const draft = readDraft(storage, userId);
        if (draft && draft.date !== today) clearDraft(storage, userId);
        const draftAt = draft && draft.date === today ? (Number(draft.updatedAt) || 0) : 0;
        if (draft && draft.date === today && hasContent(draft.form) && (!saved || draftAt > savedAt)) {
            return {
                source: 'draft',
                form: draft.form,
                savedId: draft.savedId || (saved && saved.id) || null
            };
        }
        if (draft && draft.date === today && saved && draftAt <= savedAt) clearDraft(storage, userId);
        if (saved && hasContent(normalizeForm(saved))) {
            const form = normalizeForm(saved);
            return { source: 'saved', form, savedId: saved.id || null };
        }
        return { source: null, form: null, savedId: null };
    }

    function makeId(date, now, list) {
        let id = `${date}_${now}`;
        const used = new Set((list || []).map(w => w && w.id).filter(Boolean));
        let n = 2;
        while (used.has(id)) {
            id = `${date}_${now}_${n}`;
            n += 1;
        }
        return id;
    }

    function validSet(set) {
        if (!set || set.reps == null || set.reps === '' || set.weight == null || set.weight === '') return false;
        const reps = Number(set.reps);
        const weight = Number(set.weight);
        return reps > 0 && weight >= 0;
    }

    function formRecord(form, id, now, createdAt) {
        const exercises = ((form && form.exercises) || []).map(normalizeExercise)
            .map(ex => ({ kind: ex.kind, sets: ex.sets.filter(validSet), pump: ex.pump }))
            .filter(ex => ex.kind && ex.sets.length);
        return {
            id,
            createdAt: createdAt || new Date(now).toISOString(),
            updatedAt: now,
            date: form.date,
            time: form.time || '',
            sleepQuality: form.sleepQuality,
            stressLevel: form.stressLevel,
            bodyWeight: form.bodyWeight != null && form.bodyWeight !== '' ? form.bodyWeight : null,
            muscleSoreness: form.muscleSoreness,
            sick: form.sick || 'no',
            injured: form.injured || 'no',
            exercises,
            duration: form.duration || 0
        };
    }

    function writeTombstones(storage, key, removed, now) {
        if (!removed.length) return [];
        const tsKey = `${key}_tombstones`;
        let existing = [];
        try {
            const parsed = JSON.parse(storage.getItem(tsKey) || '[]');
            existing = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            existing = [];
        }
        const byId = new Map(existing.filter(t => t && t.id).map(t => [t.id, t]));
        const written = [];
        removed.forEach(workout => {
            if (!workout || !workout.id) return;
            const stone = {
                id: workout.id,
                deleted: true,
                deletedAt: now,
                updatedAt: now,
                date: recordDate(workout)
            };
            if (workout.type) stone.type = workout.type;
            byId.set(workout.id, stone);
            written.push(stone);
        });
        storage.setItem(tsKey, JSON.stringify(Array.from(byId.values())));
        const records = global.LiftLogicRecords;
        if (records && records.markDirty) {
            try { records.markDirty(); } catch (e) { /* sync flag is best-effort */ }
        }
        return written;
    }

    /**
     * Store `form`. When its date is `today`, replace that day's lifting
     * workout in place (same id) and retire any other lifts dated today.
     * A different date is appended as its own record and does not reopen.
     */
    function applySave(list, form, today, now) {
        const next = (list || []).slice();
        const date = form && form.date;
        if (!date || date !== today) {
            const record = formRecord(form, makeId(date || 'nodate', now, next), now);
            next.push(record);
            return { list: next, record, removed: [] };
        }
        const indexes = [];
        next.forEach((workout, index) => {
            if (workout && !workout.deleted && !isRide(workout) && recordDate(workout) === today) indexes.push(index);
        });
        let keepIndex = form.id ? indexes.find(index => next[index].id === form.id) : -1;
        if (keepIndex == null || keepIndex < 0) {
            const newest = pickNewest(indexes.map(index => next[index]));
            keepIndex = newest ? indexes.find(index => next[index] === newest) : -1;
        }
        const kept = keepIndex >= 0 ? next[keepIndex] : null;
        const id = (kept && kept.id) || form.id || makeId(today, now, next);
        const record = formRecord(form, id, now, kept && kept.createdAt);
        record.date = today;
        const removed = [];
        if (keepIndex >= 0) {
            next[keepIndex] = record;
            indexes.filter(index => index !== keepIndex).sort((a, b) => b - a).forEach(index => {
                if (next[index] && next[index].id && next[index].id !== id) removed.push(next[index]);
                next.splice(index, 1);
            });
        } else {
            next.push(record);
        }
        return { list: next, record: clone(record), removed };
    }

    function commit(storage, userId, form, options) {
        const opts = options || {};
        const today = opts.today;
        const now = opts.now || Date.now();
        const key = storageKey(userId);
        const applied = applySave(readList(storage, key), form, today, now);
        storage.setItem(key, JSON.stringify(applied.list));
        const tombstones = writeTombstones(storage, key, applied.removed, now);
        clearDraft(storage, userId);
        return { record: applied.record, removed: applied.removed, tombstones, list: applied.list };
    }

    /** Explicit Load is blocked only by exercises the user typed themselves. */
    function loadIsBlocked(hasNamedExercises, fromResume) {
        return !!hasNamedExercises && !fromResume;
    }

    global.LiftLogicSession = {
        storageKey,
        draftKey,
        recordDate,
        hasContent,
        normalizeForm,
        resumeFor,
        readDraft,
        writeDraft,
        clearDraft,
        applySave,
        commit,
        loadIsBlocked
    };
})(typeof window !== 'undefined' ? window : globalThis);
