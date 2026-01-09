/**
 * Single source of truth for workout schedule data.
 * All pages should import and render from this file.
 */

const SCHEDULE_DATA = {
    title: "5-Day Hypertrophy Split",
    guidelines: "40-minute workouts. 90s rest between sets. RIR 1-3 for hypertrophy. Legs trained once weekly for strength. Shoulders hit 3x/week. Abs trained daily with exercise variety. Research-backed volume: 17+ sets/week for pecs, shoulders, and abs.",
    footer: "5-Day Hypertrophy Split — 2026",
    days: [
        {
            name: "Monday",
            number: 1,
            focus: "Push A",
            isRest: false,
            exercises: [
                { name: "Dumbbell Bench Press", sets: "4 × 6-10" },
                { name: "Barbell Overhead Press", sets: "3 × 6-10" },
                { name: "Cable Chest Fly", sets: "3 × 12-15" },
                { name: "Dips (Chest Focus)", sets: "3 × 8-12" },
                { name: "Cable Tricep Pushdown", sets: "3 × 12-15" },
                { name: "Cable Crunch", sets: "3 × 15-20" }
            ]
        },
        {
            name: "Tuesday",
            number: 2,
            focus: "Pull A",
            isRest: false,
            exercises: [
                { name: "Weighted Pull-Ups", sets: "4 × 6-10" },
                { name: "Barbell Bent-Over Row", sets: "4 × 8-10" },
                { name: "Cable Face Pulls", sets: "3 × 15-20" },
                { name: "Barbell Curl", sets: "3 × 8-12" },
                { name: "Hanging Leg Raises", sets: "3 × 10-15" },
                { name: "Pallof Press", sets: "2 × 12-15 / side" }
            ]
        },
        {
            name: "Wednesday",
            number: 3,
            focus: "Legs",
            isRest: false,
            exercises: [
                { name: "Barbell Front Squat", sets: "4 × 6-8" },
                { name: "Bulgarian Split Squat (DBs)", sets: "3 × 8-10 / leg" },
                { name: "Barbell Romanian Deadlift", sets: "4 × 8-10" },
                { name: "Goblet Squat (Tempo 3-0-1)", sets: "3 × 15-20" },
                { name: "Weighted Calf Raises (Bar)", sets: "3 × 15-20" },
                { name: "Plank Hold", sets: "2 × 45-60s" }
            ]
        },
        {
            name: "Thursday",
            number: 4,
            focus: "Upper Back + Arms",
            isRest: false,
            exercises: [
                { name: "Weighted Pull-Ups", sets: "3 × 6-10" },
                { name: "One-Arm Dumbbell Row", sets: "4 × 10-12 / arm" },
                { name: "Cable Face Pulls", sets: "3 × 15-20" },
                { name: "Cable Rear Delt Fly", sets: "3 × 15-20" },
                { name: "Dumbbell Hammer Curls", sets: "3 × 10-12" },
                { name: "Overhead Tricep Extension", sets: "3 × 10-12" },
                { name: "Ab Wheel Rollout", sets: "3 × 8-12" }
            ]
        },
        {
            name: "Friday",
            number: 5,
            focus: "Shoulders + Abs",
            isRest: false,
            exercises: [
                { name: "Dumbbell Shoulder Press", sets: "4 × 8-12" },
                { name: "Dumbbell Lateral Raises", sets: "3 × 12-15" },
                { name: "Cable Front Raise", sets: "3 × 12-15" },
                { name: "Hanging Leg Raises", sets: "3 × 10-15" },
                { name: "Cable Woodchop", sets: "3 × 12-15 / side" },
                { name: "Dead Bug", sets: "2 × 10-12 / side" }
            ]
        },
        {
            name: "Saturday",
            number: 6,
            focus: "Active Recovery",
            isRest: true,
            restNote: "Light cardio (20-30min), foam rolling, stretching. Optional: easy hike or bike ride."
        },
        {
            name: "Sunday",
            number: 7,
            focus: "Complete Rest",
            isRest: true,
            restNote: "Full recovery. Focus on sleep, hydration, meal prep for the week. Optional mobility work only."
        }
    ]
};

/**
 * Renders a single day card HTML
 */
function renderDayCard(day, useH2 = false) {
    const headingTag = useH2 ? 'h2' : 'h3';
    const restClass = day.isRest ? ' rest' : '';
    
    let exercisesHTML = '';
    if (day.isRest) {
        exercisesHTML = `<p class="rest-note">${day.restNote}</p>`;
    } else {
        const exerciseItems = day.exercises.map(ex => 
            `<li class="exercise-item"><span class="exercise-name">${ex.name}</span><span class="exercise-sets">${ex.sets}</span></li>`
        ).join('\n                        ');
        exercisesHTML = `<ul class="exercise-list">
                        ${exerciseItems}
                    </ul>`;
    }

    return `
                <div class="day-card${restClass}">
                    <div class="day-header">
                        <${headingTag} class="day-title"><span class="day-number">${day.number}</span>${day.name}</${headingTag}>
                        <span class="day-focus">${day.focus}</span>
                    </div>
                    ${exercisesHTML}
                </div>`;
}

/**
 * Renders all day cards HTML
 */
function renderAllDayCards(useH2 = false) {
    return SCHEDULE_DATA.days.map(day => renderDayCard(day, useH2)).join('\n');
}

/**
 * Renders the complete schedule modal HTML
 */
function renderScheduleModalHTML() {
    const daysHTML = renderAllDayCards(false);
    
    return `
        <div id="scheduleModal" class="schedule-modal">
            <div class="schedule-modal-content">
                <div class="schedule-modal-header">
                    <h2 style="margin: 0;">${SCHEDULE_DATA.title}</h2>
                    <button class="schedule-close-btn" onclick="closeScheduleModal()" aria-label="Close">&times;</button>
                </div>
                <div class="schedule-modal-body">
                    <p style="margin-bottom: 24px; color: #4A4A4A;">${SCHEDULE_DATA.guidelines}</p>
                    ${daysHTML}
                </div>
            </div>
        </div>
    `;
}

/**
 * Renders the schedule for the main schedule page (with h2 headings)
 */
function renderSchedulePage() {
    return renderAllDayCards(true);
}

/**
 * Injects the schedule modal into the page
 */
function injectScheduleModal() {
    // Remove existing modal if present
    const existingModal = document.getElementById('scheduleModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', renderScheduleModalHTML());
}

/**
 * Renders schedule into a container element (for schedule page)
 */
function renderScheduleIntoContainer(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = renderAllDayCards(true);
    }
}

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SCHEDULE_DATA, renderScheduleModalHTML, renderSchedulePage, injectScheduleModal, renderScheduleIntoContainer };
}

