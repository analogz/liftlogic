/**
 * LiftLogic Exercise Database
 * Centralized source of truth for exercise → muscle group mapping
 */

const ExerciseDB = (function() {

    // ========================================
    // EXERCISE DATABASE
    // Each exercise has: muscle group, equipment, optional notes
    // ========================================

    const EXERCISES = {
        // === CHEST ===
        'Dumbbell Bench Press': { muscle: 'Chest', equipment: 'dumbbells, bench' },
        'Barbell Bench Press': { muscle: 'Chest', equipment: 'barbell, bench' },
        'Incline Dumbbell Press': { muscle: 'Chest', equipment: 'dumbbells, incline bench' },
        'Incline Barbell Press': { muscle: 'Chest', equipment: 'barbell, incline bench' },
        'Decline Bench Press': { muscle: 'Chest', equipment: 'barbell, decline bench' },
        'Cable Chest Fly': { muscle: 'Chest', equipment: 'cable machine' },
        'Dumbbell Fly': { muscle: 'Chest', equipment: 'dumbbells, bench' },
        'Pec Deck': { muscle: 'Chest', equipment: 'pec deck machine' },
        'Low-to-High Cable Fly': { muscle: 'Chest', equipment: 'cable machine' },
        'High-to-Low Cable Fly': { muscle: 'Chest', equipment: 'cable machine' },
        'Dips (Chest Focus)': { muscle: 'Chest', equipment: 'dip bars' },
        'Push-Ups': { muscle: 'Chest', equipment: 'bodyweight' },
        'Machine Chest Press': { muscle: 'Chest', equipment: 'chest press machine' },

        // === BACK ===
        'Weighted Pull-Ups': { muscle: 'Back', equipment: 'pull-up bar, weight belt' },
        'Pull-Ups': { muscle: 'Back', equipment: 'pull-up bar' },
        'Chin-Ups': { muscle: 'Back', equipment: 'pull-up bar' },
        'Lat Pulldown': { muscle: 'Back', equipment: 'cable machine' },
        'Barbell Row': { muscle: 'Back', equipment: 'barbell' },
        'Dumbbell Row': { muscle: 'Back', equipment: 'dumbbells' },
        'One-Arm Dumbbell Row': { muscle: 'Back', equipment: 'dumbbell, bench' },
        'Seated Cable Row': { muscle: 'Back', equipment: 'cable machine' },
        'T-Bar Row': { muscle: 'Back', equipment: 't-bar' },
        'Pendlay Row': { muscle: 'Back', equipment: 'barbell' },
        'Face Pull': { muscle: 'Back', equipment: 'cable machine' },
        'Deadlift': { muscle: 'Back', equipment: 'barbell' },
        'Romanian Deadlift': { muscle: 'Back', equipment: 'barbell' },
        'Rack Pull': { muscle: 'Back', equipment: 'barbell, rack' },
        'Straight-Arm Pulldown': { muscle: 'Back', equipment: 'cable machine' },
        'Machine Row': { muscle: 'Back', equipment: 'row machine' },
        'Inverted Row': { muscle: 'Back', equipment: 'barbell, rack' },

        // === SHOULDERS ===
        'Barbell Overhead Press': { muscle: 'Shoulders', equipment: 'barbell' },
        'Dumbbell Shoulder Press': { muscle: 'Shoulders', equipment: 'dumbbells' },
        'Arnold Press': { muscle: 'Shoulders', equipment: 'dumbbells' },
        'Lateral Raise': { muscle: 'Shoulders', equipment: 'dumbbells' },
        'Dumbbell Lateral Raise': { muscle: 'Shoulders', equipment: 'dumbbells' },
        'Cable Lateral Raise': { muscle: 'Shoulders', equipment: 'cable machine' },
        'Machine Lateral Raise': { muscle: 'Shoulders', equipment: 'lateral raise machine' },
        'Front Raise': { muscle: 'Shoulders', equipment: 'dumbbells' },
        'Rear Delt Fly': { muscle: 'Shoulders', equipment: 'dumbbells' },
        'Reverse Pec Deck': { muscle: 'Shoulders', equipment: 'pec deck machine' },
        'Upright Row': { muscle: 'Shoulders', equipment: 'barbell' },
        'Shrugs': { muscle: 'Shoulders', equipment: 'dumbbells' },
        'Barbell Shrugs': { muscle: 'Shoulders', equipment: 'barbell' },
        'Military Press': { muscle: 'Shoulders', equipment: 'barbell' },
        'Push Press': { muscle: 'Shoulders', equipment: 'barbell' },
        'Machine Shoulder Press': { muscle: 'Shoulders', equipment: 'shoulder press machine' },
        'Lu Raises': { muscle: 'Shoulders', equipment: 'dumbbells' },

        // === ARMS (Biceps) ===
        'Barbell Curl': { muscle: 'Arms', equipment: 'barbell' },
        'Dumbbell Curl': { muscle: 'Arms', equipment: 'dumbbells' },
        'Hammer Curl': { muscle: 'Arms', equipment: 'dumbbells' },
        'Incline Dumbbell Curl': { muscle: 'Arms', equipment: 'dumbbells, incline bench' },
        'Preacher Curl': { muscle: 'Arms', equipment: 'preacher bench, barbell' },
        'Cable Curl': { muscle: 'Arms', equipment: 'cable machine' },
        'Concentration Curl': { muscle: 'Arms', equipment: 'dumbbell' },
        'EZ Bar Curl': { muscle: 'Arms', equipment: 'ez bar' },
        'Spider Curl': { muscle: 'Arms', equipment: 'dumbbells, incline bench' },

        // === ARMS (Triceps) ===
        'Cable Tricep Pushdown': { muscle: 'Arms', equipment: 'cable machine' },
        'Tricep Pushdown': { muscle: 'Arms', equipment: 'cable machine' },
        'Rope Pushdown': { muscle: 'Arms', equipment: 'cable machine' },
        'Overhead Tricep Extension': { muscle: 'Arms', equipment: 'dumbbell' },
        'Cable Overhead Extension': { muscle: 'Arms', equipment: 'cable machine' },
        'Skull Crushers': { muscle: 'Arms', equipment: 'barbell, bench' },
        'Close-Grip Bench Press': { muscle: 'Arms', equipment: 'barbell, bench' },
        'Dips (Tricep Focus)': { muscle: 'Arms', equipment: 'dip bars' },
        'Diamond Push-Ups': { muscle: 'Arms', equipment: 'bodyweight' },
        'Tricep Kickback': { muscle: 'Arms', equipment: 'dumbbells' },

        // === LEGS ===
        'Back Squat': { muscle: 'Legs', equipment: 'barbell, rack' },
        'Front Squat': { muscle: 'Legs', equipment: 'barbell, rack' },
        'Goblet Squat': { muscle: 'Legs', equipment: 'dumbbell' },
        'Leg Press': { muscle: 'Legs', equipment: 'leg press machine' },
        'Hack Squat': { muscle: 'Legs', equipment: 'hack squat machine' },
        'Bulgarian Split Squat': { muscle: 'Legs', equipment: 'dumbbells, bench' },
        'Lunges': { muscle: 'Legs', equipment: 'dumbbells' },
        'Walking Lunges': { muscle: 'Legs', equipment: 'dumbbells' },
        'Romanian Deadlift': { muscle: 'Legs', equipment: 'barbell' },
        'Stiff-Leg Deadlift': { muscle: 'Legs', equipment: 'barbell' },
        'Leg Curl': { muscle: 'Legs', equipment: 'leg curl machine' },
        'Lying Leg Curl': { muscle: 'Legs', equipment: 'leg curl machine' },
        'Seated Leg Curl': { muscle: 'Legs', equipment: 'leg curl machine' },
        'Leg Extension': { muscle: 'Legs', equipment: 'leg extension machine' },
        'Calf Raise': { muscle: 'Legs', equipment: 'calf raise machine' },
        'Standing Calf Raise': { muscle: 'Legs', equipment: 'smith machine' },
        'Seated Calf Raise': { muscle: 'Legs', equipment: 'seated calf machine' },
        'Hip Thrust': { muscle: 'Legs', equipment: 'barbell, bench' },
        'Glute Bridge': { muscle: 'Legs', equipment: 'bodyweight' },
        'Step-Ups': { muscle: 'Legs', equipment: 'dumbbells, box' },
        'Box Jumps': { muscle: 'Legs', equipment: 'plyo box' },
        'Wall Sit': { muscle: 'Legs', equipment: 'bodyweight' },

        // === ABS / CORE ===
        'Hanging Leg Raises': { muscle: 'Abs', equipment: 'pull-up bar' },
        'Hanging Knee Raises': { muscle: 'Abs', equipment: 'pull-up bar' },
        'Hanging Oblique Raises': { muscle: 'Abs', equipment: 'pull-up bar' },
        'Cable Crunch': { muscle: 'Abs', equipment: 'cable machine' },
        'Ab Wheel Rollout': { muscle: 'Abs', equipment: 'ab wheel' },
        'Plank': { muscle: 'Abs', equipment: 'bodyweight' },
        'Plank Hold': { muscle: 'Abs', equipment: 'bodyweight' },
        'Side Plank': { muscle: 'Abs', equipment: 'bodyweight' },
        'Russian Twist': { muscle: 'Abs', equipment: 'bodyweight' },
        'Bicycle Crunch': { muscle: 'Abs', equipment: 'bodyweight' },
        'Crunches': { muscle: 'Abs', equipment: 'bodyweight' },
        'Sit-Ups': { muscle: 'Abs', equipment: 'bodyweight' },
        'Leg Raises': { muscle: 'Abs', equipment: 'bodyweight' },
        'Lying Leg Raises': { muscle: 'Abs', equipment: 'bodyweight' },
        'V-Ups': { muscle: 'Abs', equipment: 'bodyweight' },
        'Mountain Climbers': { muscle: 'Abs', equipment: 'bodyweight' },
        'Dead Bug': { muscle: 'Abs', equipment: 'bodyweight' },
        'Pallof Press': { muscle: 'Abs', equipment: 'cable machine' },
        'Woodchop': { muscle: 'Abs', equipment: 'cable machine' },
        'Dragon Flag': { muscle: 'Abs', equipment: 'bench' },
        'L-Sit': { muscle: 'Abs', equipment: 'parallettes' },
        'Decline Sit-Ups': { muscle: 'Abs', equipment: 'decline bench' },
        'Toe Touches': { muscle: 'Abs', equipment: 'bodyweight' },
        'Flutter Kicks': { muscle: 'Abs', equipment: 'bodyweight' },
        'Reverse Crunch': { muscle: 'Abs', equipment: 'bodyweight' }
    };

    // ========================================
    // FALLBACK KEYWORD MATCHING
    // For exercises not in the database
    // ========================================

    const MUSCLE_KEYWORDS = {
        'Chest': ['bench', 'chest', 'fly', 'pec', 'push-up', 'pushup'],
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
     * First checks database, then falls back to keyword matching
     */
    function getMuscleGroup(exerciseName) {
        if (!exerciseName) return 'Other';

        // 1. Check exact match in database
        if (EXERCISES[exerciseName]) {
            return EXERCISES[exerciseName].muscle;
        }

        // 2. Check case-insensitive match
        const lowerName = exerciseName.toLowerCase();
        for (const [name, data] of Object.entries(EXERCISES)) {
            if (name.toLowerCase() === lowerName) {
                return data.muscle;
            }
        }

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
     * Get exercise info (muscle, equipment)
     */
    function getExerciseInfo(exerciseName) {
        if (EXERCISES[exerciseName]) {
            return EXERCISES[exerciseName];
        }

        // Case-insensitive lookup
        const lowerName = exerciseName.toLowerCase();
        for (const [name, data] of Object.entries(EXERCISES)) {
            if (name.toLowerCase() === lowerName) {
                return data;
            }
        }

        // Not found - return inferred data
        return {
            muscle: getMuscleGroup(exerciseName),
            equipment: 'unknown'
        };
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
        if (EXERCISES[exerciseName]) return true;
        const lower = exerciseName.toLowerCase();
        return Object.keys(EXERCISES).some(n => n.toLowerCase() === lower);
    }

    /**
     * Add a custom exercise (runtime only, not persisted)
     */
    function addExercise(name, muscle, equipment = 'unknown') {
        EXERCISES[name] = { muscle, equipment };
    }

    // ========================================
    // EXPOSE API
    // ========================================

    return {
        getMuscleGroup,
        getExerciseInfo,
        getExercisesForMuscle,
        getMuscleGroups,
        getAllExercises,
        hasExercise,
        addExercise,
        // Expose raw data for debugging
        _exercises: EXERCISES,
        _keywords: MUSCLE_KEYWORDS
    };
})();

// Make globally available
window.ExerciseDB = ExerciseDB;

