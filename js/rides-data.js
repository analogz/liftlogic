/**
 * LiftLogic — Bike ride catalog + helpers
 *
 * Curated Bay Area gravel / XC / enduro rides for the "Log Ride" picker.
 * Stats are only included where a public source lists them (see `source`);
 * they describe the referenced route, not a requirement for what you log.
 * Rules change — always check the land manager's page before riding.
 *
 * Rides are stored in the same `workouts` array as lifts, with
 * `type: 'ride'` so cloud sync carries them and lifting analytics skip them.
 */

const RIDE_TYPES = {
    gravel:  { label: 'Gravel',           icon: '🪨' },
    xc:      { label: 'XC / Trail',       icon: '🌲' },
    enduro:  { label: 'Enduro / Downhill', icon: '⛰️' },
    mixed:   { label: 'Mixed',            icon: '🔀' },
    road:    { label: 'Road',             icon: '🛣️' }
};

const RIDE_REGIONS = [
    'Peninsula — Skyline & Coast',
    'South Bay Foothills',
    'Santa Cruz Mountains & Coast',
    'Marin',
    'South County & Monterey'
];

const RIDES = [
    // ---------------- Peninsula — Skyline & Coast ----------------
    {
        id: 'purisima-creek',
        name: 'Purisima Creek Redwoods (Grand Loop)',
        region: 'Peninsula — Skyline & Coast',
        type: 'mixed',
        distanceMi: 19.1, climbFt: 4273,
        difficulty: 'Intermediate',
        note: 'Harkins Ridge grind up, Whittemore Gulch flow down through redwoods.',
        restriction: 'Designated trails only; helmet required; 15 mph; no e-bikes. Whittemore Gulch can close to bikes when wet.',
        source: 'https://www.mtbproject.com/trail/5274679/purisima-creek-grand-loop',
        manager: 'https://www.openspace.org/preserves/purisima-creek-redwoods'
    },
    {
        id: 'el-corte-de-madera',
        name: 'El Corte de Madera Creek (ECdM loop)',
        region: 'Peninsula — Skyline & Coast',
        type: 'enduro',
        distanceMi: 11.5, climbFt: 2051,
        difficulty: 'Advanced',
        note: 'Peninsula’s most technical singletrack — Giant Salamander, Methuselah, rooty redwood descents.',
        restriction: 'Designated trails only; South Leaf Trail is closed to bikes; no e-bikes.',
        source: 'https://www.mtbproject.com/trail/491142/el-corte-madera-open-space-loop',
        manager: 'https://www.openspace.org/preserves/el-corte-de-madera-creek'
    },
    {
        id: 'skyline-watershed-ridge',
        name: 'Skyline Watershed Ridge Trail (SFPUC)',
        region: 'Peninsula — Skyline & Coast',
        type: 'gravel',
        distanceMi: 12, climbFt: 1500,
        difficulty: 'Intermediate',
        note: 'New Bay Area Ridge Trail segment on the SF watershed — 6 mi each way of crushed rock, ridge views.',
        restriction: 'Free annual SFPUC permit required; 6am–6pm; no e-bikes or dogs; out-and-back only.',
        source: 'https://www.sfpuc.gov/learning/come-visit/peninsula-trails/skyline-watershed-ridge-trail/skyline-watershed-ridge-trail',
        manager: 'https://www.sfpuc.gov/skyline-watershed-ridge-trail'
    },
    {
        id: 'fifield-cahill-ridge',
        name: 'Fifield-Cahill Ridge Trail (SFPUC)',
        region: 'Peninsula — Skyline & Coast',
        type: 'gravel',
        distanceMi: 10, climbFt: null,
        difficulty: 'Intermediate',
        note: '10 mi watershed gravel road from Hwy 92 toward Sweeney Ridge — rarely-ridden, big views.',
        restriction: 'Reservation-only docent-led groups (Wed/Sat/Sun); 15 mph; no e-bikes.',
        source: 'https://www.sfpuc.gov/learning/come-visit/fifield-cahill-ridge-trail',
        manager: 'https://www.sfpuc.gov/learning/come-visit/fifield-cahill-ridge-trail'
    },
    {
        id: 'planet-of-the-apes',
        name: 'Planet of the Apes — Old San Pedro Mtn Rd',
        region: 'Peninsula — Skyline & Coast',
        type: 'gravel',
        distanceMi: 5.8, climbFt: 948,
        difficulty: 'Intermediate',
        note: 'Pacifica → Montara over broken old pavement and dirt; ocean views from McNee Ranch.',
        restriction: 'State Parks fire roads only (Class 1 e-bikes OK on fire roads); side singletrack is not open to bikes.',
        source: 'https://www.gravelmap.com/map/route/7805-planet-of-the-apes',
        manager: 'https://www.parks.ca.gov/?page_id=532'
    },
    {
        id: 'skyline-ridge-linkup',
        name: 'Skyline Riding — Russian Ridge / Coal Creek / Monte Bello',
        region: 'Peninsula — Skyline & Coast',
        type: 'mixed',
        distanceMi: 23.1, climbFt: 2807,
        difficulty: 'Intermediate',
        note: 'Ridge-top linkup of Midpen preserves — grassy ridgelines and Pacific views.',
        restriction: 'Midpen designated trails only; helmet required; 15 mph.',
        source: 'https://www.mtbproject.com/trail/7057408/skyline-riding',
        manager: 'https://www.openspace.org/where-to-go/what-to-do/biking'
    },
    {
        id: 'mid-peninsula-linkup',
        name: 'Mid-Peninsula Linkup (epic)',
        region: 'Peninsula — Skyline & Coast',
        type: 'mixed',
        distanceMi: 26.9, climbFt: 4011,
        difficulty: 'Advanced',
        note: 'Big-day tour stringing together the Skyline preserves.',
        restriction: 'Midpen designated trails only; helmet required; 15 mph.',
        source: 'https://www.mtbproject.com/trail/362943/mid-peninsula-linkup',
        manager: 'https://www.openspace.org/where-to-go/what-to-do/biking'
    },
    {
        id: 'windy-hill-spring-ridge',
        name: 'Windy Hill — Spring Ridge climb',
        region: 'Peninsula — Skyline & Coast',
        type: 'gravel',
        distanceMi: 2.7, climbFt: 1239,
        difficulty: 'Advanced (steep)',
        note: 'Short, savage fire-road climb (max ~22%) from Portola Valley to Skyline.',
        restriction: 'Bikes on designated trails only (e.g. not Hamms Gulch).',
        source: 'https://www.mtbproject.com/trail/7018428/spring-ridge-trail',
        manager: 'https://www.openspace.org/preserves/windy-hill'
    },
    {
        id: 'alpine-road-dirt',
        name: 'Alpine Road dirt (Coal Creek)',
        region: 'Peninsula — Skyline & Coast',
        type: 'gravel',
        distanceMi: 2.7, climbFt: 1000,
        difficulty: 'Intermediate',
        note: 'Classic unpaved climb to Page Mill, recently rebuilt by Midpen.',
        restriction: 'Midpen rules: helmet required; 15 mph.',
        source: 'https://www.openspace.org/stories/midpen-improves-alpine-road-trail-generations-come',
        manager: 'https://www.openspace.org/preserves/coal-creek'
    },
    {
        id: 'old-haul-road',
        name: 'Old Haul Road (Pescadero Creek)',
        region: 'Peninsula — Skyline & Coast',
        type: 'gravel',
        distanceMi: 5.7, climbFt: null,
        difficulty: 'Beginner–Intermediate',
        note: 'Quiet redwood service road deep in the La Honda backcountry.',
        restriction: 'Bikes on Old Haul Road; check county trail status.',
        source: 'https://www.smcgov.org/parks/trail/old-haul-road',
        manager: 'https://www.smcgov.org/parks/trail/old-haul-road'
    },
    {
        id: 'arastradero',
        name: 'Pearson-Arastradero Preserve',
        region: 'Peninsula — Skyline & Coast',
        type: 'xc',
        distanceMi: null, climbFt: null,
        difficulty: 'Beginner–Intermediate',
        note: 'Mellow rolling foothill loops in Palo Alto — good recovery spin.',
        restriction: 'Designated bike trails only; helmet; 15 mph; seasonal trails close after rain; no bikes through Gate D.',
        source: 'https://www.paloalto.gov/Departments/Community-Services/Parks-Open-Space-Golf-Division/Neighborhood-Parks/Pearson-Arastradero-Preserve',
        manager: 'https://www.paloalto.gov/Departments/Community-Services/Parks-Open-Space-Golf-Division/Open-Space-Preserves/Rules-Regulations'
    },

    // ---------------- South Bay Foothills ----------------
    {
        id: 'montebello-black-mountain',
        name: 'Montebello Rd → Black Mountain',
        region: 'South Bay Foothills',
        type: 'gravel',
        distanceMi: 17.3, climbFt: 2390,
        difficulty: 'Intermediate',
        note: 'Paved switchbacks to dirt fire road over Black Mountain (2,800 ft), Stevens Creek descent.',
        restriction: 'Midpen designated trails; 15 mph speed limit is enforced.',
        source: 'https://www.mtbproject.com/trail/7011254/monte-bello-stevens-creek-loop',
        manager: 'https://www.openspace.org/preserves/monte-bello'
    },
    {
        id: 'sierra-azul-kennedy-limekiln',
        name: 'Sierra Azul — Kennedy / Limekiln / Priest Rock',
        region: 'South Bay Foothills',
        type: 'enduro',
        distanceMi: 13.8, climbFt: 3300,
        difficulty: 'Advanced',
        note: 'Brutal fire-road climbs and steep, loose descents above Los Gatos.',
        restriction: 'Midpen rules; helmet required; bikes allowed on Sierra Azul trails.',
        source: 'https://openspacetrust.org/hike/kennedy-limekiln-area-loop/',
        manager: 'https://www.openspace.org/preserves/sierra-azul'
    },
    {
        id: 'mt-umunhum',
        name: 'Mount Umunhum Trail (Sierra Azul)',
        region: 'South Bay Foothills',
        type: 'xc',
        distanceMi: null, climbFt: null,
        difficulty: 'Intermediate–Advanced',
        note: 'Long singletrack climb to the summit cube — huge South Bay views.',
        restriction: 'Bikes allowed except the final short summit section (hike only).',
        source: 'https://www.openspace.org/preserves/sierra-azul',
        manager: 'https://www.openspace.org/preserves/sierra-azul'
    },

    // ---------------- Santa Cruz Mountains & Coast ----------------
    {
        id: 'demo-forest',
        name: 'Soquel Demo Forest — Flow / Braille / Sawpit',
        region: 'Santa Cruz Mountains & Coast',
        type: 'enduro',
        distanceMi: 20, climbFt: 3679,
        difficulty: 'Advanced',
        note: 'The Bay Area’s premier legal enduro — Flow Trails, Braille (≈1,000 ft drop) and Sawpit.',
        restriction: 'Braille, Flow and Sawpit are downhill-only; e-bikes prohibited.',
        source: 'https://www.trailforks.com/route/demo-flow-sawpit/',
        manager: 'https://www.fire.ca.gov/What-We-Do/Natural-Resource-Management/Demonstration-State-Forests/Soquel-Demonstration-State-Forest'
    },
    {
        id: 'wilder-ranch',
        name: 'Wilder Ranch — Best of Wilder',
        region: 'Santa Cruz Mountains & Coast',
        type: 'xc',
        distanceMi: 16.6, climbFt: 1371,
        difficulty: 'Intermediate–Difficult',
        note: 'Ocean-bluff fire roads plus ~40% fast, flowy singletrack above Santa Cruz.',
        restriction: 'State Park — stay on bike-legal trails.',
        source: 'https://www.mtbproject.com/trail/7011506/best-of-wilder-ranch',
        manager: 'https://www.parks.ca.gov/'
    },
    {
        id: 'nisene-aptos-fire-road',
        name: 'Nisene Marks — Aptos Creek Fire Road',
        region: 'Santa Cruz Mountains & Coast',
        type: 'gravel',
        distanceMi: null, climbFt: null,
        difficulty: 'Intermediate',
        note: 'Long redwood gravel climb that connects up to Demo Forest.',
        restriction: 'Bikes on the fire road and a few lower trails only; other singletrack is hike-only.',
        source: 'https://www.mtbproject.com/trail/7004973/aptos-creek-fire-road',
        manager: 'https://www.parks.ca.gov/?page_id=666'
    },
    {
        id: 'cotoni-coast-dairies',
        name: 'Cotoni-Coast Dairies (BLM)',
        region: 'Santa Cruz Mountains & Coast',
        type: 'xc',
        distanceMi: null, climbFt: null,
        difficulty: 'Intermediate',
        note: 'Newer national-monument trails above Davenport with coastal views.',
        restriction: 'Hawk, Tree and Wildcat trails open to bikes (Class 1 e-bikes OK); sunrise–sunset.',
        source: 'https://www.blm.gov/cotoni-coast-dairies',
        manager: 'https://www.blm.gov/cotoni-coast-dairies'
    },

    // ---------------- Marin ----------------
    {
        id: 'camp-tamarancho',
        name: 'Camp Tamarancho — Endor Flow',
        region: 'Marin',
        type: 'enduro',
        distanceMi: null, climbFt: null,
        difficulty: 'Intermediate–Advanced',
        note: 'Marin’s best purpose-built singletrack; Endor is a jump/flow line.',
        restriction: 'Day pass required; Endor is downhill-only and closes in rain + 3 days after.',
        source: 'https://www.boyscouts-marin.org/tamarancho-mtn-biking/4023',
        manager: 'https://www.boyscouts-marin.org/tamarancho-mtn-biking/4023'
    },
    {
        id: 'mt-tam-old-railroad-grade',
        name: 'Mt Tam — Old Railroad Grade',
        region: 'Marin',
        type: 'gravel',
        distanceMi: 7.1, climbFt: 2123,
        difficulty: 'Intermediate',
        note: 'Historic railroad grade fire road from Mill Valley to East Peak — bay-to-ocean views.',
        restriction: 'MMWD watershed — wide fire road; follow posted MMWD trail rules.',
        source: 'https://www.mtbproject.com/trail/7007743/old-railroad-grade',
        manager: 'https://www.mtbproject.com/trail/7007743/old-railroad-grade'
    },

    // ---------------- South County & Monterey ----------------
    {
        id: 'henry-coe',
        name: 'Henry W. Coe State Park backcountry',
        region: 'South County & Monterey',
        type: 'mixed',
        distanceMi: null, climbFt: null,
        difficulty: 'Advanced',
        note: 'Huge, remote, steep — big gravel days from Hunting Hollow / Coit Road.',
        restriction: 'Singletrack closes ~48 hrs after rain; check trail conditions.',
        source: 'https://coepark.net/planning-your-visit/trail-conditions/',
        manager: 'https://www.parks.ca.gov/?page_id=25827'
    },
    {
        id: 'fort-ord',
        name: 'Fort Ord National Monument',
        region: 'South County & Monterey',
        type: 'xc',
        distanceMi: null, climbFt: null,
        difficulty: 'Beginner–Advanced',
        note: '86+ mi of authorized trails — home of the Sea Otter Classic.',
        restriction: 'Stay on authorized BLM trails.',
        source: 'https://www.trailforks.com/region/fort-ord-national-monument/',
        manager: 'https://www.blm.gov/programs/national-conservation-lands/california/fort-ord-national-monument'
    }
];

// ------------------------------------------------------------------
// Helpers (global, no build step)
// ------------------------------------------------------------------

const RIDE_CUSTOM_KEY = 'customRides';

function rideEscapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** YYYY-MM-DD in the user's LOCAL timezone (not UTC like toISOString). */
function rideLocalDateStr(d = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse YYYY-MM-DD as local midnight. */
function rideParseLocalDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return new Date(NaN);
    const p = dateStr.split('-');
    if (p.length !== 3) return new Date(dateStr);
    return new Date(+p[0], +p[1] - 1, +p[2]);
}

function isRideEntry(w) {
    return !!w && w.type === 'ride';
}

function getRideById(id) {
    return RIDES.find(r => r.id === id) || null;
}

function getRidesByRegion() {
    return RIDE_REGIONS.map(region => ({
        region,
        rides: RIDES.filter(r => r.region === region)
    })).filter(g => g.rides.length > 0);
}

function getCustomRideNames(workouts) {
    let names = [];
    try {
        names = JSON.parse(localStorage.getItem(RIDE_CUSTOM_KEY) || '[]');
        if (!Array.isArray(names)) names = [];
    } catch (e) {
        names = [];
    }
    // Also pick up custom names from synced rides (e.g. logged on another device)
    (workouts || []).forEach(w => {
        if (isRideEntry(w) && w.rideId === 'custom' && w.rideName) names.push(w.rideName);
    });
    const seen = new Set();
    return names
        .map(n => String(n).trim())
        .filter(n => n && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()))
        .sort((a, b) => a.localeCompare(b));
}

function saveCustomRideName(name) {
    const clean = String(name || '').trim().slice(0, 80);
    if (!clean) return;
    let names = [];
    try {
        names = JSON.parse(localStorage.getItem(RIDE_CUSTOM_KEY) || '[]');
        if (!Array.isArray(names)) names = [];
    } catch (e) {
        names = [];
    }
    if (!names.some(n => String(n).toLowerCase() === clean.toLowerCase())) {
        names.push(clean);
        localStorage.setItem(RIDE_CUSTOM_KEY, JSON.stringify(names));
    }
}

/** Start of the current week (Monday, matching the Mon–Sun schedule). */
function rideWeekStart(now = new Date()) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const offset = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
    d.setDate(d.getDate() - offset);
    return d;
}

/** Summary used by the dashboard. */
function summarizeRides(rides, now = new Date()) {
    const weekStart = rideWeekStart(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sum = (list, key) => list.reduce((t, r) => t + (parseFloat(r[key]) || 0), 0);
    const valid = (rides || []).filter(r => isRideEntry(r) && !isNaN(rideParseLocalDate(r.date)));
    const week = valid.filter(r => rideParseLocalDate(r.date) >= weekStart);
    const month = valid.filter(r => rideParseLocalDate(r.date) >= monthStart);
    const recent = [...valid].sort((a, b) =>
        (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))
    );
    return {
        week:  { count: week.length,  miles: sum(week, 'distanceMi'),  climbFt: sum(week, 'elevationFt') },
        month: { count: month.length, miles: sum(month, 'distanceMi'), climbFt: sum(month, 'elevationFt') },
        total: valid.length,
        recent
    };
}

if (typeof window !== 'undefined') {
    Object.assign(window, {
        RIDES, RIDE_TYPES, RIDE_REGIONS, rideEscapeHtml, rideLocalDateStr, rideParseLocalDate,
        isRideEntry, getRideById, getRidesByRegion, getCustomRideNames, saveCustomRideName,
        rideWeekStart, summarizeRides
    });
}
