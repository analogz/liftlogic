/**
 * LiftLogic record bookkeeping for sync (workouts + rides).
 *
 * - Every record gets `updatedAt` (ms since epoch) when created or edited.
 * - A delete becomes a tombstone `{ id, deleted: true, deletedAt, updatedAt }`.
 *   Tombstones live in their own localStorage key (`<workoutsKey>_tombstones`)
 *   so the regular `workouts` array that every page reads never contains them,
 *   and they are uploaded to Firestore as docs with `deleted: true`.
 * - Merge rule: match by id, newest `updatedAt` wins (missing = 0); a tombstone
 *   counts as an update. Ties keep the tombstone, otherwise the cloud copy.
 */
(function () {
    const DIRTY_KEY = 'liftlogicSyncDirty';

    function now() { return Date.now(); }

    function newId(w) {
        const date = (w && (w.date || (w.dailyInfo && w.dailyInfo.currentDate))) || 'nodate';
        const prefix = w && w.type === 'ride' ? 'ride_' : '';
        return `${prefix}${date}_${now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function ts(w) {
        const t = w && Number(w.updatedAt);
        return Number.isFinite(t) ? t : 0;
    }

    function isTombstone(w) { return !!(w && w.deleted === true); }

    /** Mark a record as created/edited now. Returns the record. */
    function touch(w) {
        if (!w.id) w.id = newId(w);
        w.updatedAt = now();
        return w;
    }

    function makeTombstone(w, at) {
        const t = at || now();
        const stone = { id: w.id, deleted: true, deletedAt: t, updatedAt: t };
        const date = w.date || (w.dailyInfo && w.dailyInfo.currentDate);
        if (date) stone.date = date;
        if (w.type) stone.type = w.type;
        return stone;
    }

    function tombstoneKey(workoutsKey) { return `${workoutsKey || 'workouts'}_tombstones`; }

    function readJson(key) {
        try {
            const v = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(v) ? v : [];
        } catch (e) { return []; }
    }

    function getTombstones(workoutsKey) { return readJson(tombstoneKey(workoutsKey)); }

    /** Live records plus tombstones, as one list (for merging/sync). */
    function loadAll(workoutsKey) {
        const key = workoutsKey || 'workouts';
        return readJson(key).concat(getTombstones(key));
    }

    /** Split a combined list back into the live array and the tombstone list. */
    function saveAll(workoutsKey, all) {
        const key = workoutsKey || 'workouts';
        const live = [], stones = [];
        all.forEach(w => (isTombstone(w) ? stones : live).push(w));
        localStorage.setItem(key, JSON.stringify(live));
        localStorage.setItem(tombstoneKey(key), JSON.stringify(stones));
        return { live, tombstones: stones };
    }

    /** Record a delete locally (adds/updates the tombstone). */
    function addTombstones(workoutsKey, records) {
        const key = tombstoneKey(workoutsKey);
        const byId = new Map(readJson(key).map(t => [t.id, t]));
        const at = now();
        records.forEach(r => { if (r && r.id) byId.set(r.id, makeTombstone(r, at)); });
        localStorage.setItem(key, JSON.stringify(Array.from(byId.values())));
    }

    function markDirty() { localStorage.setItem(DIRTY_KEY, String(now())); }
    function clearDirty() { localStorage.removeItem(DIRTY_KEY); }
    function isDirty() { return !!localStorage.getItem(DIRTY_KEY); }

    /** Pick the winner between two versions of the same id. */
    function pick(local, cloud) {
        if (!local) return cloud;
        if (!cloud) return local;
        const tl = ts(local), tc = ts(cloud);
        if (tl > tc) return local;
        if (tc > tl) return cloud;
        if (isTombstone(local) !== isTombstone(cloud)) return isTombstone(local) ? local : cloud;
        return cloud;
    }

    /**
     * Merge by id. Returns { merged, toUpload } where toUpload are records the
     * cloud is missing or holds an older version of.
     */
    function mergeById(local, cloud) {
        const cloudById = new Map();
        (cloud || []).forEach(w => { if (w && w.id) cloudById.set(w.id, w); });

        // Collapse local duplicates by id first (e.g. a tombstone and a
        // re-imported live copy), newest wins.
        const localById = new Map();
        (local || []).forEach(w => {
            if (!w) return;
            if (!w.id) w.id = newId(w);
            const prev = localById.get(w.id);
            localById.set(w.id, prev ? pick(w, prev) : w);
        });

        const merged = new Map(cloudById);
        const toUpload = [];
        localById.forEach((lw, id) => {
            const cw = cloudById.get(id);
            const win = pick(lw, cw);
            merged.set(id, win);
            if (win === lw && (!cw || ts(lw) > ts(cw) || isTombstone(lw) !== isTombstone(cw))) toUpload.push(lw);
        });

        const list = Array.from(merged.values()).sort((a, b) => {
            const da = a.date || (a.dailyInfo && a.dailyInfo.currentDate) || '';
            const db = b.date || (b.dailyInfo && b.dailyInfo.currentDate) || '';
            return db.localeCompare(da);
        });
        return { merged: list, toUpload };
    }

    // ---------- content identity (for de-duplication) ----------

    function num(v) {
        if (v === '' || v === null || v === undefined) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : String(v);
    }

    /**
     * A signature of what a workout actually contains: date + exercises/sets
     * (rides: date + ride fields). Returns null when there is nothing to compare
     * (no date, or a lifting entry with no sets) so such entries are never
     * treated as duplicates.
     */
    function contentSignature(w) {
        if (!w || isTombstone(w)) return null;
        const date = w.date || (w.dailyInfo && w.dailyInfo.currentDate);
        if (!date) return null;
        if (w.type === 'ride') {
            return JSON.stringify(['ride', date, w.time || null, w.rideId || null, w.rideName || null,
                num(w.durationMin != null ? w.durationMin : w.duration), num(w.distanceMi), num(w.elevationFt)]);
        }
        const di = w.dailyInfo || {};
        const f = k => num(w[k] !== undefined && w[k] !== null ? w[k] : di[k]);
        const ex = (w.exercises || []).map(e => [
            String(e.kind || e.name || '').trim().toLowerCase(),
            (e.sets || []).map(s => [num(s.weight), num(s.reps), num(s.rir), num(s.rpe)]),
            num(e.pump), e.notes || null
        ]);
        if (!ex.length || ex.every(e => !e[1].length)) return null;
        const time = w.time || di.currentTime || null;
        return JSON.stringify(['lift', date, time, ex,
            f('bodyWeight'), f('sleepQuality'), f('stressLevel'), f('muscleSoreness')]);
    }

    /**
     * Find groups of content-identical records. `preferIds` (a Set) marks ids
     * to keep when possible (e.g. ids that exist in the cloud).
     * Returns [{ keep, drop: [...] }].
     */
    function findDuplicates(records, preferIds) {
        const groups = new Map();
        records.forEach(w => {
            const sig = contentSignature(w);
            if (!sig) return;
            if (!groups.has(sig)) groups.set(sig, []);
            groups.get(sig).push(w);
        });
        const out = [];
        groups.forEach(list => {
            if (list.length < 2) return;
            const ranked = list.slice().sort((a, b) => {
                const pa = preferIds && preferIds.has(a.id) ? 1 : 0;
                const pb = preferIds && preferIds.has(b.id) ? 1 : 0;
                if (pa !== pb) return pb - pa;
                const fa = a.date ? 1 : 0, fb = b.date ? 1 : 0; // prefer current format
                if (fa !== fb) return fb - fa;
                return ts(b) - ts(a);
            });
            out.push({ keep: ranked[0], drop: ranked.slice(1) });
        });
        return out;
    }

    /** Copy fields the kept copy lacks from the dropped copies (never overwrite). */
    function absorb(keep, drops) {
        const added = [];
        drops.forEach(d => Object.keys(d).forEach(k => {
            if (['id', 'updatedAt', 'syncedAt', 'odId', 'dailyInfo', 'deleted', 'deletedAt'].includes(k)) return;
            if ((keep[k] === undefined || keep[k] === null || keep[k] === '') && d[k] !== undefined && d[k] !== null && d[k] !== '') {
                keep[k] = d[k]; added.push(k);
            }
        }));
        return added;
    }

    window.LiftLogicRecords = {
        now, newId, ts, isTombstone, touch, makeTombstone, tombstoneKey, getTombstones,
        loadAll, saveAll, addTombstones, markDirty, clearDirty, isDirty,
        pick, mergeById, contentSignature, findDuplicates, absorb
    };
})();
