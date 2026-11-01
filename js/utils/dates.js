/**
 * LiftLogic date helpers — all workout dates are LOCAL calendar dates.
 *
 * Never use `toISOString()` to derive a calendar date: it converts to UTC,
 * so e.g. 5:30pm in Los Angeles becomes "tomorrow". Never use
 * `new Date("YYYY-MM-DD")` either: it parses as UTC midnight, which shifts
 * the day backward in negative-UTC timezones.
 *
 * Weeks are Monday-start (matching the program schedule) and identified with
 * ISO-8601 week ids ("2026-W44").
 */
(function (global) {
    function pad(n) {
        return String(n).padStart(2, '0');
    }

    /** Date -> "YYYY-MM-DD" in local time (defaults to now). */
    function localDateStr(date) {
        const d = date instanceof Date ? date : new Date(date === undefined ? Date.now() : date);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    /** "YYYY-MM-DD" -> Date at local midnight. Non-matching input falls back to `new Date(input)`. */
    function parseLocalDate(dateStr) {
        if (!dateStr) return new Date(NaN);
        if (typeof dateStr !== 'string') return new Date(dateStr);
        const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateStr.trim());
        if (!m) return new Date(dateStr);
        return new Date(+m[1], +m[2] - 1, +m[3]);
    }

    /** Monday 00:00 local of the week containing `date` (defaults to now). */
    function startOfWeek(date) {
        const d = date instanceof Date ? new Date(date) : (date ? parseLocalDate(date) : new Date());
        d.setHours(0, 0, 0, 0);
        const daysSinceMonday = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
        d.setDate(d.getDate() - daysSinceMonday);
        return d;
    }

    /** "YYYY-MM-DD" of the Monday starting the week containing `date`. */
    function weekStartStr(date) {
        return localDateStr(startOfWeek(date));
    }

    /** ISO-8601 week id for `date` (local calendar), e.g. "2026-W44". */
    function isoWeekId(date) {
        const d = startOfWeek(date);
        // Thursday of this week decides the ISO year
        const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3);
        const isoYear = thursday.getFullYear();
        const jan4 = new Date(isoYear, 0, 4);
        const week1Monday = startOfWeek(jan4);
        // Round to absorb DST hour shifts
        const week = 1 + Math.round((d - week1Monday) / (7 * 24 * 60 * 60 * 1000));
        return `${isoYear}-W${pad(week)}`;
    }

    global.LiftLogicDates = {
        localDateStr,
        parseLocalDate,
        startOfWeek,
        weekStartStr,
        isoWeekId
    };
})(typeof window !== 'undefined' ? window : globalThis);
