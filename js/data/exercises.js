/**
 * LiftLogic Exercise Database
 * Centralized source of truth for exercises: muscle group, station, equipment,
 * target muscles — plus aliases and user-defined (custom) exercise metadata.
 *
 * Stored workout data is never rewritten: logged names (`exercise.kind`) are
 * matched to the catalog at read time (case/whitespace/plural-insensitive,
 * plus the ALIASES map below).
 */

const ExerciseDB = (function() {

    // ========================================
    // STATIONS (where in the gym you do it)
    // ========================================

    const STATIONS = [
        { id: 'dumbbells',  label: 'Dumbbells',          description: 'Dumbbell rack (bench optional)' },
        { id: 'short-bar',  label: 'Short Olympic Bar',  description: 'EZ / short barbell' },
        { id: 'bench',      label: 'Bench',              description: 'Bench-press bench & rack' },
        { id: 'cable',      label: 'Cable Machine',      description: 'Cable stack & attachments' },
        { id: 'dip',        label: 'Dip Station',        description: 'Dip bars / parallettes' },
        { id: 'pullup',     label: 'Pull-up Bar',        description: 'Pull-ups & hanging work' },
        { id: 'bodyweight', label: 'Bodyweight / Floor', description: 'Mat & floor work' },
        { id: 'bike',       label: 'Bike',               description: 'Cycling' },
        { id: 'machines',   label: 'Machines',           description: 'Selectorized & plate-loaded machines' },
        { id: 'other',      label: 'Other',              description: 'Everything else' }
    ];
    const STATION_IDS = STATIONS.map(s => s.id);

    // ========================================
    // EXERCISE DATABASE
    // muscle   = primary muscle group (used by dashboard & leaderboard stats)
    // station  = STATIONS id
    // targets  = muscles worked, primary first
    // ========================================

    const E = (muscle, station, equipment, targets) => ({ muscle, station, equipment, targets });

    const EXERCISES = {
        // === CHEST ===
        'Dumbbell Bench Press':          E('Chest', 'dumbbells', 'dumbbells, bench', ['Chest', 'Triceps', 'Front Delts']),
        'Incline Dumbbell Press':        E('Chest', 'dumbbells', 'dumbbells, incline bench', ['Upper Chest', 'Front Delts', 'Triceps']),
        'Decline Dumbbell Press':        E('Chest', 'dumbbells', 'dumbbells, decline bench', ['Lower Chest', 'Triceps']),
        'Dumbbell Fly':                  E('Chest', 'dumbbells', 'dumbbells, bench', ['Chest']),
        'Dumbbell Flyes - Incline':      E('Chest', 'dumbbells', 'dumbbells, incline bench', ['Upper Chest']),
        'Dumbbell Flyes - Decline':      E('Chest', 'dumbbells', 'dumbbells, decline bench', ['Lower Chest']),
        'Dumbbell Pullovers':            E('Chest', 'dumbbells', 'dumbbell, bench', ['Chest', 'Lats']),
        'Single-Arm Dumbbell Press':     E('Chest', 'dumbbells', 'dumbbell, bench', ['Chest', 'Triceps', 'Core']),
        'Dumbbell Squeeze Press':        E('Chest', 'dumbbells', 'dumbbells, bench', ['Inner Chest', 'Triceps']),
        'Barbell Bench Press':           E('Chest', 'bench', 'barbell, bench', ['Chest', 'Triceps', 'Front Delts']),
        'Incline Barbell Press':         E('Chest', 'bench', 'barbell, incline bench', ['Upper Chest', 'Front Delts', 'Triceps']),
        'Decline Bench Press':           E('Chest', 'bench', 'barbell, decline bench', ['Lower Chest', 'Triceps']),
        'Cable Chest Fly':               E('Chest', 'cable', 'cable machine', ['Chest']),
        'Low-to-High Cable Fly':         E('Chest', 'cable', 'cable machine', ['Upper Chest']),
        'High-to-Low Cable Fly':         E('Chest', 'cable', 'cable machine', ['Lower Chest']),
        'Cable Crossovers':              E('Chest', 'cable', 'cable machine', ['Chest']),
        'Cable Chest Press - High':      E('Chest', 'cable', 'cable machine', ['Lower Chest', 'Triceps']),
        'Cable Chest Press - Mid':       E('Chest', 'cable', 'cable machine', ['Chest', 'Triceps']),
        'Cable Chest Press - Low':       E('Chest', 'cable', 'cable machine', ['Upper Chest', 'Triceps']),
        'Dips':                          E('Chest', 'dip', 'dip bars', ['Chest', 'Triceps', 'Front Delts']),
        'Dips (Chest Focus)':            E('Chest', 'dip', 'dip bars', ['Lower Chest', 'Triceps']),
        'Push-Ups':                      E('Chest', 'bodyweight', 'bodyweight', ['Chest', 'Triceps', 'Front Delts']),
        'Pec Deck':                      E('Chest', 'machines', 'pec deck machine', ['Chest']),
        'Machine Chest Press':           E('Chest', 'machines', 'chest press machine', ['Chest', 'Triceps']),

        // === BACK ===
        'Weighted Pull-Ups':             E('Back', 'pullup', 'pull-up bar, weight belt', ['Lats', 'Biceps', 'Upper Back']),
        'Pull-Ups':                      E('Back', 'pullup', 'pull-up bar', ['Lats', 'Biceps']),
        'Pull-ups - Wide Grip':          E('Back', 'pullup', 'pull-up bar', ['Lats', 'Upper Back']),
        'Neutral Grip Pull-ups':         E('Back', 'pullup', 'pull-up bar', ['Lats', 'Biceps']),
        'Chin-Ups':                      E('Back', 'pullup', 'pull-up bar', ['Lats', 'Biceps']),
        'Lat Pulldown':                  E('Back', 'cable', 'cable machine', ['Lats', 'Biceps']),
        'Lat Pulldowns - Wide Grip':     E('Back', 'cable', 'cable machine', ['Lats', 'Upper Back']),
        'Seated Cable Row':              E('Back', 'cable', 'cable machine', ['Mid Back', 'Lats', 'Biceps']),
        'Straight-Arm Pulldown':         E('Back', 'cable', 'cable machine', ['Lats']),
        'Cable Face Pulls':              E('Back', 'cable', 'cable machine', ['Rear Delts', 'Upper Back']),
        'Barbell Bent-Over Row':         E('Back', 'short-bar', 'barbell', ['Upper Back', 'Lats', 'Biceps']),
        'Pendlay Row':                   E('Back', 'short-bar', 'barbell', ['Upper Back', 'Lats']),
        'T-Bar Row':                     E('Back', 'short-bar', 't-bar / landmine', ['Mid Back', 'Lats']),
        'Deadlift':                      E('Back', 'short-bar', 'barbell', ['Hamstrings', 'Glutes', 'Lower Back']),
        'Rack Pull':                     E('Back', 'short-bar', 'barbell, rack', ['Upper Back', 'Lower Back', 'Traps']),
        'Dumbbell Row':                  E('Back', 'dumbbells', 'dumbbells', ['Lats', 'Mid Back']),
        'One-Arm Dumbbell Row':          E('Back', 'dumbbells', 'dumbbell, bench', ['Lats', 'Mid Back']),
        'Chest-Supported Dumbbell Row':  E('Back', 'dumbbells', 'dumbbells, incline bench', ['Mid Back', 'Lats']),
        'Dumbbell Deadlifts':            E('Back', 'dumbbells', 'dumbbells', ['Hamstrings', 'Glutes', 'Lower Back']),
        'Inverted Row':                  E('Back', 'bodyweight', 'bar, rack', ['Upper Back', 'Biceps']),
        'Machine Row':                   E('Back', 'machines', 'row machine', ['Mid Back', 'Lats']),

        // === SHOULDERS ===
        'Barbell Overhead Press':        E('Shoulders', 'short-bar', 'barbell', ['Front Delts', 'Triceps']),
        'Military Press':                E('Shoulders', 'short-bar', 'barbell', ['Front Delts', 'Triceps']),
        'Push Press':                    E('Shoulders', 'short-bar', 'barbell', ['Front Delts', 'Triceps', 'Legs']),
        'Upright Row':                   E('Shoulders', 'short-bar', 'barbell', ['Side Delts', 'Traps']),
        'Barbell Shrugs':                E('Shoulders', 'short-bar', 'barbell', ['Traps']),
        'Dumbbell Shoulder Press':       E('Shoulders', 'dumbbells', 'dumbbells', ['Front Delts', 'Triceps']),
        'Arnold Press':                  E('Shoulders', 'dumbbells', 'dumbbells', ['Front Delts', 'Side Delts', 'Triceps']),
        'Dumbbell Lateral Raises':       E('Shoulders', 'dumbbells', 'dumbbells', ['Side Delts']),
        'Front Raise':                   E('Shoulders', 'dumbbells', 'dumbbells', ['Front Delts']),
        'Dumbbell Rear Delt Fly':        E('Shoulders', 'dumbbells', 'dumbbells', ['Rear Delts', 'Upper Back']),
        'Dumbbell Shrugs':               E('Shoulders', 'dumbbells', 'dumbbells', ['Traps']),
        'Lu Raises':                     E('Shoulders', 'dumbbells', 'dumbbells', ['Side Delts', 'Front Delts']),
        'Cable Lateral Raise':           E('Shoulders', 'cable', 'cable machine', ['Side Delts']),
        'Cable Front Raises':            E('Shoulders', 'cable', 'cable machine', ['Front Delts']),
        'Cable Rear Delt Flyes':         E('Shoulders', 'cable', 'cable machine', ['Rear Delts']),
        'Standing Cable Shoulder Press': E('Shoulders', 'cable', 'cable machine', ['Front Delts', 'Triceps']),
        'Machine Lateral Raise':         E('Shoulders', 'machines', 'lateral raise machine', ['Side Delts']),
        'Reverse Pec Deck':              E('Shoulders', 'machines', 'pec deck machine', ['Rear Delts']),
        'Machine Shoulder Press':        E('Shoulders', 'machines', 'shoulder press machine', ['Front Delts', 'Triceps']),

        // === ARMS (Biceps) ===
        'Barbell Curl':                  E('Arms', 'short-bar', 'barbell', ['Biceps']),
        'EZ Bar Curl':                   E('Arms', 'short-bar', 'ez bar', ['Biceps']),
        'Preacher Curl':                 E('Arms', 'short-bar', 'preacher bench, ez bar', ['Biceps']),
        'Dumbbell Curl':                 E('Arms', 'dumbbells', 'dumbbells', ['Biceps']),
        'Hammer Curl':                   E('Arms', 'dumbbells', 'dumbbells', ['Biceps', 'Forearms']),
        'Incline Dumbbell Curl':         E('Arms', 'dumbbells', 'dumbbells, incline bench', ['Biceps']),
        'Concentration Curl':            E('Arms', 'dumbbells', 'dumbbell', ['Biceps']),
        'Spider Curl':                   E('Arms', 'dumbbells', 'dumbbells, incline bench', ['Biceps']),
        'Cable Curl':                    E('Arms', 'cable', 'cable machine', ['Biceps']),
        'Cable Hammer Curls':            E('Arms', 'cable', 'cable machine', ['Biceps', 'Forearms']),

        // === ARMS (Triceps) ===
        'Cable Tricep Pushdown':         E('Arms', 'cable', 'cable machine', ['Triceps']),
        'Rope Pushdown':                 E('Arms', 'cable', 'cable machine, rope', ['Triceps']),
        'Cable Overhead Extension':      E('Arms', 'cable', 'cable machine', ['Triceps']),
        'Overhead Tricep Extension':     E('Arms', 'dumbbells', 'dumbbell', ['Triceps']),
        'Dumbbell Skull Crushers':       E('Arms', 'dumbbells', 'dumbbells, bench', ['Triceps']),
        'Tricep Kickback':               E('Arms', 'dumbbells', 'dumbbells', ['Triceps']),
        'Skull Crushers':                E('Arms', 'short-bar', 'ez bar, bench', ['Triceps']),
        'Close-Grip Bench Press':        E('Arms', 'bench', 'barbell, bench', ['Triceps', 'Chest']),
        'Dips (Tricep Focus)':           E('Arms', 'dip', 'dip bars', ['Triceps', 'Chest']),
        'Diamond Push-Ups':              E('Arms', 'bodyweight', 'bodyweight', ['Triceps', 'Chest']),

        // === LEGS ===
        'Back Squat':                    E('Legs', 'short-bar', 'barbell, rack', ['Quads', 'Glutes']),
        'Front Squat':                   E('Legs', 'short-bar', 'barbell, rack', ['Quads', 'Core']),
        'Romanian Deadlift':             E('Legs', 'short-bar', 'barbell', ['Hamstrings', 'Glutes', 'Lower Back']),
        'Stiff-Leg Deadlift':            E('Legs', 'short-bar', 'barbell', ['Hamstrings', 'Lower Back']),
        'Hip Thrust':                    E('Legs', 'bench', 'barbell, bench', ['Glutes', 'Hamstrings']),
        'Goblet Squat':                  E('Legs', 'dumbbells', 'dumbbell', ['Quads', 'Glutes']),
        'Dumbbell Squats - Sumo':        E('Legs', 'dumbbells', 'dumbbell', ['Quads', 'Adductors', 'Glutes']),
        'Dumbbell Split Squats':         E('Legs', 'dumbbells', 'dumbbells', ['Quads', 'Glutes']),
        'Bulgarian Split Squat':         E('Legs', 'dumbbells', 'dumbbells, bench', ['Quads', 'Glutes']),
        'Lunges':                        E('Legs', 'dumbbells', 'dumbbells', ['Quads', 'Glutes']),
        'Dumbbell Lunges - Reverse':     E('Legs', 'dumbbells', 'dumbbells', ['Glutes', 'Quads']),
        'Walking Lunges':                E('Legs', 'dumbbells', 'dumbbells', ['Quads', 'Glutes']),
        'Dumbbell Romanian Deadlifts':   E('Legs', 'dumbbells', 'dumbbells', ['Hamstrings', 'Glutes']),
        'Single-Leg Romanian Deadlifts': E('Legs', 'dumbbells', 'dumbbell', ['Hamstrings', 'Glutes', 'Balance']),
        'Stiff-Leg Dumbbell Deadlifts':  E('Legs', 'dumbbells', 'dumbbells', ['Hamstrings', 'Lower Back']),
        'Step-Ups':                      E('Legs', 'dumbbells', 'dumbbells, box', ['Quads', 'Glutes']),
        'Dumbbell Calf Raises':          E('Legs', 'dumbbells', 'dumbbells', ['Calves']),
        'Cable Squats':                  E('Legs', 'cable', 'cable machine', ['Quads', 'Glutes']),
        'Cable Lunges':                  E('Legs', 'cable', 'cable machine', ['Quads', 'Glutes']),
        'Cable Leg Curls':               E('Legs', 'cable', 'cable machine, ankle strap', ['Hamstrings']),
        'Cable Leg Extension':           E('Legs', 'cable', 'cable machine, ankle strap', ['Quads']),
        'Leg Press':                     E('Legs', 'machines', 'leg press machine', ['Quads', 'Glutes']),
        'Hack Squat':                    E('Legs', 'machines', 'hack squat machine', ['Quads']),
        'Leg Curl':                      E('Legs', 'machines', 'leg curl machine', ['Hamstrings']),
        'Lying Leg Curl':                E('Legs', 'machines', 'leg curl machine', ['Hamstrings']),
        'Seated Leg Curl':               E('Legs', 'machines', 'leg curl machine', ['Hamstrings']),
        'Leg Extension':                 E('Legs', 'machines', 'leg extension machine', ['Quads']),
        'Calf Raise':                    E('Legs', 'machines', 'calf raise machine', ['Calves']),
        'Standing Calf Raise':           E('Legs', 'machines', 'smith machine', ['Calves']),
        'Seated Calf Raise':             E('Legs', 'machines', 'seated calf machine', ['Calves']),
        'Nordic Curls':                  E('Legs', 'bodyweight', 'bodyweight, anchor', ['Hamstrings']),
        'Glute Bridge':                  E('Legs', 'bodyweight', 'bodyweight', ['Glutes']),
        'Box Jumps':                     E('Legs', 'bodyweight', 'plyo box', ['Quads', 'Glutes', 'Power']),
        'Wall Sit':                      E('Legs', 'bodyweight', 'bodyweight', ['Quads']),
        'Cycling':                       E('Legs', 'bike', 'bike', ['Quads', 'Hamstrings', 'Cardio']),

        // === ABS / CORE ===
        'Hanging Leg Raises':            E('Abs', 'pullup', 'pull-up bar', ['Lower Abs', 'Hip Flexors']),
        'Hanging Knee Raises':           E('Abs', 'pullup', 'pull-up bar', ['Lower Abs', 'Hip Flexors']),
        'Hanging Oblique Raises':        E('Abs', 'pullup', 'pull-up bar', ['Obliques']),
        'Cable Crunch':                  E('Abs', 'cable', 'cable machine', ['Abs']),
        'Pallof Press':                  E('Abs', 'cable', 'cable machine', ['Obliques', 'Core']),
        'Woodchop':                      E('Abs', 'cable', 'cable machine', ['Obliques']),
        'L-Sit':                         E('Abs', 'dip', 'dip bars / parallettes', ['Abs', 'Hip Flexors']),
        'Dragon Flag':                   E('Abs', 'bench', 'bench', ['Abs']),
        'Decline Sit-Ups':               E('Abs', 'bench', 'decline bench', ['Abs']),
        'Dumbbell Russian Twists':       E('Abs', 'dumbbells', 'dumbbell', ['Obliques']),
        'Dumbbell Side Bends':           E('Abs', 'dumbbells', 'dumbbell', ['Obliques']),
        'Weighted Crunches':             E('Abs', 'dumbbells', 'dumbbell / plate', ['Abs']),
        'Ab Wheel Rollout':              E('Abs', 'bodyweight', 'ab wheel', ['Abs', 'Lats']),
        'Plank':                         E('Abs', 'bodyweight', 'bodyweight', ['Core']),
        'Side Plank':                    E('Abs', 'bodyweight', 'bodyweight', ['Obliques']),
        'Russian Twist':                 E('Abs', 'bodyweight', 'bodyweight', ['Obliques']),
        'Bicycle Crunch':                E('Abs', 'bodyweight', 'bodyweight', ['Abs', 'Obliques']),
        'Crunches':                      E('Abs', 'bodyweight', 'bodyweight', ['Abs']),
        'Sit-Ups':                       E('Abs', 'bodyweight', 'bodyweight', ['Abs', 'Hip Flexors']),
        'Leg Raises':                    E('Abs', 'bodyweight', 'bodyweight', ['Lower Abs']),
        'Lying Leg Raises':              E('Abs', 'bodyweight', 'bodyweight', ['Lower Abs']),
        'V-Ups':                         E('Abs', 'bodyweight', 'bodyweight', ['Abs']),
        'Mountain Climbers':             E('Abs', 'bodyweight', 'bodyweight', ['Core', 'Cardio']),
        'Dead Bug':                      E('Abs', 'bodyweight', 'bodyweight', ['Core']),
        'Toe Touches':                   E('Abs', 'bodyweight', 'bodyweight', ['Abs']),
        'Flutter Kicks':                 E('Abs', 'bodyweight', 'bodyweight', ['Lower Abs']),
        'Reverse Crunch':                E('Abs', 'bodyweight', 'bodyweight', ['Lower Abs']),

        // === FULL BODY ===
        'Dumbbell Thrusters':            E('Other', 'dumbbells', 'dumbbells', ['Quads', 'Shoulders']),
        'Dumbbell Clean and Press':      E('Other', 'dumbbells', 'dumbbells', ['Shoulders', 'Legs', 'Back']),
        'Burpees':                       E('Other', 'bodyweight', 'bodyweight', ['Full Body', 'Cardio'])
    };

    // Other spellings of the same movement → catalog name. Matching is already
    // case-, whitespace-, punctuation- and plural-insensitive (see normalizeName),
    // so only genuinely different spellings need listing here.
    const ALIASES = {
        // Tracker quick-pick names & legacy DB names
        'Dumbbell Bench Press - Flat': 'Dumbbell Bench Press',
        'Dumbbell Bench Press - Incline': 'Incline Dumbbell Press',
        'Incline Dumbbell Bench Press': 'Incline Dumbbell Press',
        'Dumbbell Bench Press - Decline': 'Decline Dumbbell Press',
        'Dumbbell Flyes - Flat': 'Dumbbell Fly',
        'Cable Chest Flyes - High to Low': 'High-to-Low Cable Fly',
        'Cable Chest Fly (high-to-low)': 'High-to-Low Cable Fly',
        'Cable Chest Flyes - Low to High': 'Low-to-High Cable Fly',
        'Cable Chest Fly (low-to-high)': 'Low-to-High Cable Fly',
        'Dip': 'Dips',
        'Pull-ups - Medium Grip': 'Pull-Ups',
        'Cable Lat Pulldowns': 'Lat Pulldown',
        'Cable Lat Pulldown': 'Lat Pulldown',
        'Wide-Grip Lat Pulldown': 'Lat Pulldowns - Wide Grip',
        'Cable Rows - Seated': 'Seated Cable Row',
        'Barbell Row': 'Barbell Bent-Over Row',
        'Face Pull': 'Cable Face Pulls',
        'Dumbbell Rows - Bent Over': 'Dumbbell Row',
        'Single-Arm Dumbbell Rows': 'One-Arm Dumbbell Row',
        'Dumbbell Shoulder Press - Seated': 'Dumbbell Shoulder Press',
        'Dumbbell Shoulder Press - Standing': 'Dumbbell Shoulder Press',
        'Dumbbell Overhead Press': 'Dumbbell Shoulder Press',
        'Lateral Raise': 'Dumbbell Lateral Raises',
        'Rear Delt Fly': 'Dumbbell Rear Delt Fly',
        'Rear Delt Flyes - Bent Over': 'Dumbbell Rear Delt Fly',
        'Dumbbell Reverse Flyes': 'Dumbbell Rear Delt Fly',
        'Reverse Cable Fly': 'Cable Rear Delt Flyes',
        'Shrugs': 'Dumbbell Shrugs',
        'Dumbbell Bicep Curls - Standing': 'Dumbbell Curl',
        'Dumbbell Bicep Curls - Seated': 'Dumbbell Curl',
        'Cable Bicep Curls': 'Cable Curl',
        'Tricep Pushdown': 'Cable Tricep Pushdown',
        'Cable Triceps Pushdown': 'Cable Tricep Pushdown',
        'Cable Tricep Pushdowns - Bar': 'Cable Tricep Pushdown',
        'Cable Tricep Pushdowns - Rope': 'Rope Pushdown',
        'Dumbbell Overhead Extension - Seated': 'Overhead Tricep Extension',
        'Dumbbell Skull Crusher': 'Dumbbell Skull Crushers',
        'Dumbbell Kickbacks': 'Tricep Kickback',
        'Dumbbell Squats - Goblet': 'Goblet Squat',
        'Dumbbell Lunges - Forward': 'Lunges',
        'Dumbbell Romanian Deadlift': 'Dumbbell Romanian Deadlifts',
        'Dumbbell Step-ups': 'Step-Ups',
        'Cable Leg Curl': 'Cable Leg Curls',
        'Cable Crunches - Kneeling': 'Cable Crunch',
        'Cable Pallof Press': 'Pallof Press',
        'Cable Woodchoppers - High to Low': 'Woodchop',
        'Plank Hold': 'Plank',
        'Dumbbell Lateral Raise': 'Dumbbell Lateral Raises',
        'Bike': 'Cycling',
        'Bike Ride': 'Cycling'
    };

    // ========================================
    // NAME MATCHING
    // ========================================

    /**
     * Normalize a name for matching: lowercase, punctuation → spaces,
     * collapsed whitespace, simple plural folding ("Dips" == "dip").
     */
    function normalizeName(name) {
        if (!name || typeof name !== 'string') return '';
        return name.toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim()
            .split(' ')
            .map(w => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) ? w.slice(0, -1) : w)
            .join(' ');
    }

    const _index = {};
    Object.keys(EXERCISES).forEach(name => { _index[normalizeName(name)] = name; });
    Object.entries(ALIASES).forEach(([alias, target]) => {
        const key = normalizeName(alias);
        if (!_index[key] && EXERCISES[target]) _index[key] = target;
    });

    /** Catalog name for any spelling, or null if it isn't a built-in */
    function resolveName(name) {
        if (!name || typeof name !== 'string') return null;
        if (EXERCISES[name]) return name;
        return _index[normalizeName(name)] || null;
    }

    /** "dips" → "Dips", "db pullover w/ band" → "Db Pullover W/ Band" (keeps existing caps) */
    function toTitleCase(name) {
        const small = new Set(['a', 'an', 'and', 'or', 'of', 'to', 'the', 'on', 'in', 'with', 'vs']);
        return String(name || '').trim().replace(/\s+/g, ' ')
            .split(' ')
            .map((word, i) => {
                if (word !== word.toLowerCase()) return word; // user chose capitals
                if (i > 0 && small.has(word)) return word;
                return word.replace(/^[a-z]/, c => c.toUpperCase())
                    .replace(/([-/(])([a-z])/g, (m, p, c) => p + c.toUpperCase());
            })
            .join(' ');
    }

    // ========================================
    // CUSTOM EXERCISES (user-defined station / muscle)
    // Stored locally under CUSTOM_KEY, keyed by normalizeName(name):
    //   { name: displayName, station, muscle, updatedAt }
    // Workout data keeps the originally typed name; this is metadata only.
    // ========================================

    const CUSTOM_KEY = 'customExercises';

    function getCustomExercises() {
        try {
            const raw = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '{}');
            return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
        } catch (e) {
            return {};
        }
    }

    function getCustomExercise(name) {
        return getCustomExercises()[normalizeName(name)] || null;
    }

    function setCustomExercise(name, { station, muscle, displayName } = {}) {
        const key = normalizeName(name);
        if (!key) return null;
        const all = getCustomExercises();
        const prev = all[key] || {};
        const entry = {
            name: displayName || prev.name || toTitleCase(name),
            station: STATION_IDS.includes(station) ? station : (prev.station || null),
            muscle: getMuscleGroups().concat('Other').includes(muscle) ? muscle : (prev.muscle || null),
            updatedAt: new Date().toISOString()
        };
        all[key] = entry;
        localStorage.setItem(CUSTOM_KEY, JSON.stringify(all));
        return entry;
    }

    /** Best-guess station for a name we don't know */
    function inferStation(name) {
        const n = ` ${normalizeName(name)} `;
        if (/ (bike|cycling|cycle|ride|spin) /.test(n)) return 'bike';
        if (/ dip /.test(n)) return 'dip';
        if (/ cable | rope | pulldown /.test(n)) return 'cable';
        if (/ (pull up|pullup|chin up|chinup|hanging) /.test(n)) return 'pullup';
        if (/ (dumbbell|db) /.test(n)) return 'dumbbells';
        if (/ (barbell|ez|bar|olympic|landmine|t bar) /.test(n)) return 'short-bar';
        if (/ bench /.test(n)) return 'bench';
        if (/ machine /.test(n)) return 'machines';
        if (/ (push up|pushup|plank|crunch|sit up|burpee) /.test(n)) return 'bodyweight';
        return 'other';
    }

    // ========================================
    // FALLBACK KEYWORD MATCHING
    // For exercises not in the database
    // ========================================

    const MUSCLE_KEYWORDS = {
        'Chest': ['bench', 'chest', 'fly', 'pec', 'push-up', 'pushup', 'dip'],
        'Back': ['row', 'pull-up', 'pullup', 'pulldown', 'lat', 'deadlift', 'back', 'chin-up', 'chinup'],
        'Shoulders': ['shoulder', 'ohp', 'overhead press', 'lateral raise', 'delt', 'shrug', 'military'],
        'Arms': ['curl', 'tricep', 'bicep', 'pushdown', 'extension', 'skull'],
        'Legs': ['squat', 'lunge', 'leg press', 'leg extension', 'leg curl', 'calf', 'ham', 'quad', 'glute', 'hip thrust'],
        'Abs': ['crunch', 'plank', 'ab ', 'abs', 'core', 'sit-up', 'situp', 'leg raise', 'rollout', 'pallof', 'woodchop', 'dead bug', 'v-up', 'flutter', 'mountain climber']
    };

    // Priority order for ambiguous matches (e.g., "leg raise" could be Legs or Abs)
    const PRIORITY_ORDER = ['Abs', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs'];

    // ========================================
    // PUBLIC API
    // ========================================

    /**
     * Get muscle group for an exercise
     * Catalog (incl. aliases) → user-assigned custom muscle → keyword matching
     */
    function getMuscleGroup(exerciseName) {
        if (!exerciseName) return 'Other';

        // 1. Catalog match (exact, normalized, or alias)
        const resolved = resolveName(exerciseName);
        if (resolved) return EXERCISES[resolved].muscle;

        // 2. User-assigned muscle for a custom exercise
        const custom = getCustomExercise(exerciseName);
        if (custom && custom.muscle) return custom.muscle;

        const lowerName = exerciseName.toLowerCase();

        // 3. Check partial match (e.g., "Dumbbell Bench Press (Heavy)" → "Dumbbell Bench Press")
        for (const [name, data] of Object.entries(EXERCISES)) {
            if (lowerName.includes(name.toLowerCase()) || name.toLowerCase().includes(lowerName)) {
                return data.muscle;
            }
        }

        // 4. Fallback to keyword matching (in priority order)
        for (const muscle of PRIORITY_ORDER) {
            const keywords = MUSCLE_KEYWORDS[muscle];
            if (keywords.some(k => lowerName.includes(k.toLowerCase()))) {
                return muscle;
            }
        }

        // 5. Unknown exercise
        return 'Other';
    }

    /**
     * Get exercise info (muscle, station, equipment, targets, builtIn, name)
     */
    function getExerciseInfo(exerciseName) {
        const resolved = resolveName(exerciseName);
        if (resolved) {
            return { name: resolved, builtIn: true, ...EXERCISES[resolved] };
        }

        const custom = getCustomExercise(exerciseName);
        const muscle = getMuscleGroup(exerciseName);
        return {
            name: (custom && custom.name) || toTitleCase(exerciseName),
            builtIn: false,
            muscle,
            station: (custom && custom.station) || null,
            suggestedStation: inferStation(exerciseName),
            equipment: 'unknown',
            targets: muscle !== 'Other' ? [muscle] : []
        };
    }

    /** Display name for a stored (possibly lowercase / aliased) name */
    function getDisplayName(exerciseName) {
        return getExerciseInfo(exerciseName).name;
    }

    /**
     * Get all exercises for a muscle group
     */
    function getExercisesForMuscle(muscleGroup) {
        return Object.entries(EXERCISES)
            .filter(([name, data]) => data.muscle === muscleGroup)
            .map(([name, data]) => ({ name, ...data }));
    }

    /**
     * Get all muscle groups
     */
    function getMuscleGroups() {
        return ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Abs'];
    }

    function getStations() {
        return STATIONS.map(s => ({ ...s }));
    }

    function getStationLabel(id) {
        const s = STATIONS.find(st => st.id === id);
        return s ? s.label : 'Other';
    }

    /**
     * Get all exercise names
     */
    function getAllExercises() {
        return Object.keys(EXERCISES);
    }

    /**
     * Check if exercise exists in database
     */
    function hasExercise(exerciseName) {
        return resolveName(exerciseName) !== null;
    }

    /**
     * Add an exercise to the catalog (runtime only, not persisted)
     */
    function addExercise(name, muscle, equipment = 'unknown', station = 'other') {
        EXERCISES[name] = { muscle, station, equipment, targets: [muscle] };
        _index[normalizeName(name)] = name;
    }

    // ========================================
    // EXPOSE API
    // ========================================

    return {
        getMuscleGroup,
        getExerciseInfo,
        getDisplayName,
        getExercisesForMuscle,
        getMuscleGroups,
        getStations,
        getStationLabel,
        getAllExercises,
        hasExercise,
        addExercise,
        resolveName,
        normalizeName,
        toTitleCase,
        inferStation,
        getCustomExercises,
        getCustomExercise,
        setCustomExercise,
        CUSTOM_KEY,
        // Expose raw data for debugging
        _exercises: EXERCISES,
        _aliases: ALIASES,
        _keywords: MUSCLE_KEYWORDS
    };
})();

// Make globally available
window.ExerciseDB = ExerciseDB;
