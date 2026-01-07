// Generate Realistic 1-Year Workout Dataset
// Based on the 40-Minute Hypertrophy Split from workout_schedule.html

function generateRealisticDataset() {
    const workouts = [];
    
    // Define the weekly schedule
    const weeklySchedule = {
        1: { // Monday - Push
            exercises: [
                { name: "Dumbbell Bench Press", sets: 3, repRange: [8, 12], muscleGroup: "chest" },
                { name: "Standing Cable Shoulder Press", sets: 3, repRange: [10, 12], muscleGroup: "shoulders" },
                { name: "Cable Chest Fly (high-to-low)", sets: 2, repRange: [12, 15], muscleGroup: "chest" },
                { name: "Cable Triceps Pushdown", sets: 2, repRange: [12, 15], muscleGroup: "triceps" },
                { name: "Lateral Raises", sets: 2, repRange: [15, 15], muscleGroup: "shoulders" }
            ]
        },
        2: { // Tuesday - Pull
            exercises: [
                { name: "Pull-Ups", sets: 3, repRange: [6, 10], muscleGroup: "back" },
                { name: "One-Arm Dumbbell Row", sets: 3, repRange: [8, 12], muscleGroup: "back" },
                { name: "Cable Lat Pulldown", sets: 2, repRange: [10, 12], muscleGroup: "back" },
                { name: "Dumbbell Curl", sets: 3, repRange: [10, 15], muscleGroup: "biceps" },
                { name: "Cable Face Pull", sets: 3, repRange: [10, 15], muscleGroup: "rear_delts" }
            ]
        },
        3: { // Wednesday - Legs
            exercises: [
                { name: "Goblet Squat", sets: 3, repRange: [8, 12], muscleGroup: "quads" },
                { name: "Dumbbell Romanian Deadlift", sets: 3, repRange: [8, 12], muscleGroup: "hamstrings" },
                { name: "Walking Lunges", sets: 2, repRange: [10, 10], muscleGroup: "legs" },
                { name: "Cable Leg Curl", sets: 2, repRange: [12, 15], muscleGroup: "hamstrings" },
                { name: "Standing Calf Raise", sets: 3, repRange: [15, 20], muscleGroup: "calves" }
            ]
        },
        4: { // Thursday - Push (Variation)
            exercises: [
                { name: "Incline Dumbbell Bench Press", sets: 3, repRange: [8, 10], muscleGroup: "chest" },
                { name: "Dumbbell Overhead Press", sets: 3, repRange: [8, 10], muscleGroup: "shoulders" },
                { name: "Cable Chest Fly (low-to-high)", sets: 2, repRange: [12, 15], muscleGroup: "chest" },
                { name: "Dumbbell Skull Crusher", sets: 2, repRange: [12, 15], muscleGroup: "triceps" },
                { name: "Lateral Raises", sets: 2, repRange: [12, 15], muscleGroup: "shoulders" }
            ]
        },
        5: { // Friday - Pull (Variation)
            exercises: [
                { name: "Chest-Supported Dumbbell Row", sets: 3, repRange: [10, 12], muscleGroup: "back" },
                { name: "Wide-Grip Lat Pulldown", sets: 3, repRange: [8, 12], muscleGroup: "back" },
                { name: "Seated Cable Row", sets: 2, repRange: [10, 15], muscleGroup: "back" },
                { name: "Preacher Curl", sets: 3, repRange: [10, 15], muscleGroup: "biceps" },
                { name: "Reverse Cable Fly", sets: 3, repRange: [10, 15], muscleGroup: "rear_delts" }
            ]
        },
        6: { // Saturday - Legs (Variation)
            exercises: [
                { name: "Bulgarian Split Squat", sets: 3, repRange: [8, 10], muscleGroup: "legs" },
                { name: "Stiff-Leg Dumbbell Deadlift", sets: 3, repRange: [10, 12], muscleGroup: "hamstrings" },
                { name: "Cable Leg Extension", sets: 2, repRange: [15, 15], muscleGroup: "quads" },
                { name: "Leg Curl", sets: 2, repRange: [12, 15], muscleGroup: "hamstrings" },
                { name: "Standing Calf Raise", sets: 3, repRange: [15, 15], muscleGroup: "calves" }
            ]
        },
        0: null // Sunday - Rest
    };
    
    // Starting date (1 year ago from today) - ensure we generate up to today
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const startDate = new Date(today);
    startDate.setFullYear(startDate.getFullYear() - 1);
    startDate.setHours(0, 0, 0, 0);
    
    // Exercise progression data - starting weights and progression patterns
    const exerciseProgressions = {
        "Dumbbell Bench Press": { startWeight: 30, progressionRate: 0.008, variation: 0.1 },
        "Standing Cable Shoulder Press": { startWeight: 25, progressionRate: 0.006, variation: 0.08 },
        "Cable Chest Fly (high-to-low)": { startWeight: 15, progressionRate: 0.005, variation: 0.1 },
        "Cable Triceps Pushdown": { startWeight: 30, progressionRate: 0.007, variation: 0.1 },
        "Lateral Raises": { startWeight: 10, progressionRate: 0.004, variation: 0.08 },
        "Pull-Ups": { startWeight: 0, progressionRate: 0.003, variation: 0.15 }, // Bodyweight
        "One-Arm Dumbbell Row": { startWeight: 35, progressionRate: 0.009, variation: 0.1 },
        "Cable Lat Pulldown": { startWeight: 60, progressionRate: 0.008, variation: 0.1 },
        "Dumbbell Curl": { startWeight: 20, progressionRate: 0.006, variation: 0.12 },
        "Cable Face Pull": { startWeight: 20, progressionRate: 0.005, variation: 0.08 },
        "Goblet Squat": { startWeight: 35, progressionRate: 0.010, variation: 0.1 },
        "Dumbbell Romanian Deadlift": { startWeight: 40, progressionRate: 0.009, variation: 0.1 },
        "Walking Lunges": { startWeight: 20, progressionRate: 0.007, variation: 0.1 },
        "Cable Leg Curl": { startWeight: 40, progressionRate: 0.007, variation: 0.1 },
        "Standing Calf Raise": { startWeight: 50, progressionRate: 0.006, variation: 0.08 },
        "Incline Dumbbell Bench Press": { startWeight: 25, progressionRate: 0.008, variation: 0.1 },
        "Dumbbell Overhead Press": { startWeight: 20, progressionRate: 0.006, variation: 0.1 },
        "Cable Chest Fly (low-to-high)": { startWeight: 15, progressionRate: 0.005, variation: 0.1 },
        "Dumbbell Skull Crusher": { startWeight: 15, progressionRate: 0.006, variation: 0.1 },
        "Chest-Supported Dumbbell Row": { startWeight: 30, progressionRate: 0.008, variation: 0.1 },
        "Wide-Grip Lat Pulldown": { startWeight: 55, progressionRate: 0.007, variation: 0.1 },
        "Seated Cable Row": { startWeight: 50, progressionRate: 0.008, variation: 0.1 },
        "Preacher Curl": { startWeight: 18, progressionRate: 0.006, variation: 0.12 },
        "Reverse Cable Fly": { startWeight: 15, progressionRate: 0.005, variation: 0.08 },
        "Bulgarian Split Squat": { startWeight: 25, progressionRate: 0.008, variation: 0.1 },
        "Stiff-Leg Dumbbell Deadlift": { startWeight: 35, progressionRate: 0.008, variation: 0.1 },
        "Cable Leg Extension": { startWeight: 35, progressionRate: 0.007, variation: 0.1 },
        "Leg Curl": { startWeight: 35, progressionRate: 0.007, variation: 0.1 }
    };
    
    // Personal state variables that evolve over time
    let currentBodyWeight = 180; // Starting body weight
    let currentFitnessLevel = 0; // Starts at 0, increases over time
    let consecutiveWorkouts = 0;
    let totalWorkouts = 0;
    let lastDeloadWeek = 0;
    let currentMood = 7; // 1-10 scale
    
    // Calculate how many weeks we need to cover (from startDate to today)
    const totalDays = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));
    const totalWeeks = Math.ceil(totalDays / 7) + 1; // +1 to ensure we cover current week
    
    console.log(`Generating ${totalWeeks} weeks of data from ${startDate.toISOString()} to ${today.toISOString()}`);
    
    // Generate workouts for all weeks up to and including this week
    for (let week = 0; week < totalWeeks; week++) {
        const weekStartDate = new Date(startDate);
        weekStartDate.setDate(startDate.getDate() + (week * 7));
        
        // Periodization: Deload every 6-8 weeks
        const isDeloadWeek = (week - lastDeloadWeek >= 6 && Math.random() > 0.3) || (week - lastDeloadWeek >= 8);
        if (isDeloadWeek) {
            lastDeloadWeek = week;
        }
        
        // Generate workouts for each day of the week
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            const currentDate = new Date(weekStartDate);
            currentDate.setDate(weekStartDate.getDate() + dayOfWeek);
            
            // Don't generate future workouts
            if (currentDate > today) {
                continue;
            }
            
            // Skip Sunday (rest day) or occasional random rest days
            // But be more consistent in recent weeks so we have data to display
            const isRecentWeek = week >= totalWeeks - 3; // Last 3 weeks - guaranteed workouts
            if (dayOfWeek === 0 || (!isRecentWeek && Math.random() > 0.85 && consecutiveWorkouts >= 3)) {
                consecutiveWorkouts = 0;
                continue;
            }
            
            // Life happens - occasionally miss workouts (but not in recent weeks)
            if (!isRecentWeek && Math.random() > 0.88) {
                consecutiveWorkouts = 0;
                continue;
            }
            
            const dayWorkout = weeklySchedule[dayOfWeek];
            if (!dayWorkout) continue;
            
            // Update fitness progression
            currentFitnessLevel = Math.min(100, currentFitnessLevel + 0.2);
            consecutiveWorkouts++;
            totalWorkouts++;
            
            // Generate realistic daily metrics
            const sleepQuality = Math.max(1, Math.min(10, Math.round(
                7 + (Math.random() - 0.5) * 4 + (currentMood - 7) * 0.3
            )));
            
            const stressLevel = Math.max(1, Math.min(10, Math.round(
                4 + (Math.random() - 0.5) * 4 + (sleepQuality < 6 ? 2 : sleepQuality > 8 ? -1 : 0)
            )));
            
            const muscleSoreness = Math.max(1, Math.min(10, Math.round(
                3 + (Math.random() - 0.5) * 4 + (consecutiveWorkouts > 4 ? 2 : 0) + (isDeloadWeek ? -2 : 0)
            )));
            
            // Body weight fluctuation (slight increase over time for muscle gain)
            currentBodyWeight += (Math.random() - 0.48) * 0.5 + (totalWorkouts > 100 ? 0.02 : 0);
            currentBodyWeight = Math.round(currentBodyWeight * 10) / 10;
            
            // Determine workout time
            const workoutHours = [6, 7, 8, 9, 17, 18, 19, 20]; // Common workout times
            const workoutHour = workoutHours[Math.floor(Math.random() * workoutHours.length)];
            const workoutMinute = Math.floor(Math.random() * 12) * 5; // 0, 5, 10, 15, ..., 55
            
            // Create workout data
            const workout = {
                dailyInfo: {
                    currentDate: currentDate.toISOString().split('T')[0],
                    currentTime: `${workoutHour.toString().padStart(2, '0')}:${workoutMinute.toString().padStart(2, '0')}`,
                    sleepQuality: sleepQuality.toString(),
                    stressLevel: stressLevel.toString(),
                    bodyWeight: currentBodyWeight.toString(),
                    muscleSoreness: muscleSoreness.toString(),
                    sick: Math.random() > 0.97 ? 'yes' : 'no',
                    injured: Math.random() > 0.99 ? 'yes' : 'no'
                },
                exercises: []
            };
            
            // Generate exercises for this workout
            dayWorkout.exercises.forEach(exerciseTemplate => {
                const progression = exerciseProgressions[exerciseTemplate.name];
                if (!progression) return;
                
                // Calculate current strength level for this exercise
                const progressionFactor = 1 + (progression.progressionRate * totalWorkouts);
                const baseWeight = progression.startWeight * progressionFactor;
                
                // Apply deload if it's a deload week
                const deloadFactor = isDeloadWeek ? 0.8 : 1.0;
                
                // Apply daily variation based on sleep, stress, soreness
                const dailyFactor = 1 + 
                    (sleepQuality - 7) * 0.02 +
                    (7 - stressLevel) * 0.015 +
                    (7 - muscleSoreness) * 0.01;
                
                const exercise = {
                    kind: exerciseTemplate.name,
                    sets: [],
                    failure: Math.random() > 0.7 ? 'yes' : 'no',
                    pump: Math.random() > 0.6 ? 'yes' : 'no',
                    rpe: Math.max(6, Math.min(10, Math.round(
                        7.5 + (Math.random() - 0.5) * 2 + 
                        (isDeloadWeek ? -1 : 0) +
                        (sleepQuality < 6 ? 1 : sleepQuality > 8 ? -0.5 : 0)
                    ))),
                    rir: Math.max(0, Math.min(5, Math.round(
                        2 + (Math.random() - 0.5) * 2 + (isDeloadWeek ? 1 : 0)
                    ))),
                    tempo: '',
                    restPeriod: 90 + Math.floor(Math.random() * 60) // 90-150 seconds
                };
                
                // Generate sets for this exercise
                for (let setNum = 0; setNum < exerciseTemplate.sets; setNum++) {
                    // Calculate weight for this set (slightly decreasing for later sets)
                    const setFatigueFactor = 1 - (setNum * 0.02);
                    let setWeight = baseWeight * deloadFactor * dailyFactor * setFatigueFactor;
                    
                    // Round to nearest 2.5 or 5 lbs depending on exercise
                    const roundingFactor = exerciseTemplate.name.includes('Dumbbell') ? 2.5 : 5;
                    setWeight = Math.round(setWeight / roundingFactor) * roundingFactor;
                    setWeight = Math.max(roundingFactor, setWeight); // Minimum weight
                    
                    // Special handling for bodyweight exercises
                    if (exerciseTemplate.name === "Pull-Ups") {
                        setWeight = 0; // Bodyweight
                    }
                    
                    // Calculate reps (decreasing slightly for later sets, within rep range)
                    const repRange = exerciseTemplate.repRange;
                    const baseReps = repRange[0] + Math.random() * (repRange[1] - repRange[0]);
                    const setReps = Math.max(repRange[0], Math.round(baseReps - setNum * 0.5));
                    
                    // Calculate RIR for this set (lower on later sets, affected by fatigue)
                    const setRIR = Math.max(0, Math.min(5, Math.round(
                        2 + (Math.random() - 0.5) * 2 + 
                        (isDeloadWeek ? 1.5 : 0) - 
                        (setNum * 0.3) // Later sets have lower RIR
                    )));
                    
                    exercise.sets.push({
                        weight: setWeight,
                        reps: setReps,
                        rir: setRIR
                    });
                }
                
                // Set backward compatibility fields (first set)
                if (exercise.sets.length > 0) {
                    exercise.weight = exercise.sets[0].weight;
                    exercise.reps = exercise.sets[0].reps;
                }
                
                workout.exercises.push(exercise);
            });
            
            workouts.push(workout);
            
            // Update mood based on workout completion and progress
            currentMood = Math.max(1, Math.min(10, currentMood + 
                (Math.random() - 0.4) * 0.5 + // Random daily variation
                (consecutiveWorkouts > 3 ? 0.1 : 0) + // Consistency bonus
                (totalWorkouts % 10 === 0 ? 0.2 : 0) // Milestone bonus
            ));
        }
    }
    
    return workouts;
}

// Export the function and generate the dataset
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateRealisticDataset };
} else {
    // Browser environment - make it globally available
    window.generateRealisticDataset = generateRealisticDataset;
}

// Generate and log the dataset
console.log('Generating realistic 1-year workout dataset...');
const realisticWorkouts = generateRealisticDataset();
console.log(`Generated ${realisticWorkouts.length} workouts over 1 year`);
console.log('Sample workout:', JSON.stringify(realisticWorkouts[0], null, 2));

// Function to save the dataset to localStorage
function saveRealisticDataset() {
    const workouts = generateRealisticDataset();
    localStorage.setItem('workouts', JSON.stringify(workouts));
    console.log(`Saved ${workouts.length} realistic workouts to localStorage`);
    return workouts;
}

// Function to load the realistic dataset (for testing)
function loadRealisticDataset() {
    const workouts = JSON.parse(localStorage.getItem('workouts') || '[]');
    console.log(`Loaded ${workouts.length} workouts from localStorage`);
    return workouts;
}

// Make these functions globally available
if (typeof window !== 'undefined') {
    window.saveRealisticDataset = saveRealisticDataset;
    window.loadRealisticDataset = loadRealisticDataset;
} 