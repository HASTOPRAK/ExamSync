/**
 * Demo dataset presets for testing the scheduling engine.
 *
 * Each preset defines rooms, instructors, courses, and enrollment cohorts.
 * Time slots are NOT included — they are generated at seed-time from the
 * exam period's actual start/end dates (2 slots per weekday, 09:00 and 13:00).
 *
 * Enrollment cohorts describe groups of students who all take the same set
 * of courses. A student belongs to exactly one cohort.
 *
 * Expected score bands assume a standard 2-week exam period (~20 slots over
 * 10 weekdays). Actual scores will vary slightly based on exact dates.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  EASY      15 courses — 5 isolated groups of 3. Sparse conflict graph,
 *            comfortable rooms. Scheduler has maximum freedom.
 *            Expected score: 95–100
 *
 *  STANDARD  24 courses — 4 year groups of 6 with bridge cohorts that
 *            cross-link adjacent years. Moderate conflict density,
 *            mixed room sizes.
 *            Expected score: 85–94
 *
 *  STRESSED  35 courses — 11 campus-wide mandatory courses taken by all
 *            students, plus 4 dept groups of 6. The 11 mandatory courses
 *            form a clique of size 11; with only 10 available days the
 *            scheduler is GUARANTEED to land two of them on the same day,
 *            creating unavoidable same-day student conflicts. Small rooms
 *            force multi-room assignments and lower per-room utilization.
 *            Expected score: 65–80
 * ─────────────────────────────────────────────────────────────────────────
 */

export const PRESETS = {
  // ─── EASY ──────────────────────────────────────────────────────────────
  easy: {
    meta: {
      label: "Easy",
      description:
        "15 courses across 5 isolated subject groups. No cross-group conflicts — " +
        "the scheduler has maximum freedom to spread every exam onto a clear day.",
      expectedScore: "95–100",
    },

    rooms: [
      { room_code: "A101", building: "A Block", capacity: 100 },
      { room_code: "A102", building: "A Block", capacity: 100 },
      { room_code: "A103", building: "A Block", capacity: 100 },
      { room_code: "B101", building: "B Block", capacity: 100 },
      { room_code: "B102", building: "B Block", capacity: 100 },
      { room_code: "B103", building: "B Block", capacity: 100 },
      { room_code: "C101", building: "C Block", capacity: 100 },
      { room_code: "C102", building: "C Block", capacity: 100 },
    ],

    instructors: [
      { full_name: "Dr. Alice Cooper",  email: "acooper@demo.edu",  instructor_type: "assistant" },
      { full_name: "Dr. Bob Martin",    email: "bmartin@demo.edu",   instructor_type: "assistant" },
      { full_name: "Dr. Carol White",   email: "cwhite@demo.edu",    instructor_type: "assistant" },
      { full_name: "Dr. David Black",   email: "dblack@demo.edu",    instructor_type: "assistant" },
      { full_name: "Dr. Eva Green",     email: "egreen@demo.edu",    instructor_type: "assistant" },
    ],

    courses: [
      // Group A — Mathematics (indices 0-2)
      { course_code: "MATH101", course_name: "Calculus I",       exam_duration_minutes: 75 },
      { course_code: "MATH102", course_name: "Calculus II",      exam_duration_minutes: 75 },
      { course_code: "MATH201", course_name: "Linear Algebra",   exam_duration_minutes: 75 },
      // Group B — Computer Science (indices 3-5)
      { course_code: "CS101",   course_name: "Intro to Programming", exam_duration_minutes: 60 },
      { course_code: "CS102",   course_name: "Data Structures",      exam_duration_minutes: 60 },
      { course_code: "CS201",   course_name: "Algorithms",           exam_duration_minutes: 75 },
      // Group C — Physics (indices 6-8)
      { course_code: "PHY101",  course_name: "Mechanics",            exam_duration_minutes: 75 },
      { course_code: "PHY102",  course_name: "Electromagnetism",     exam_duration_minutes: 75 },
      { course_code: "PHY201",  course_name: "Thermodynamics",       exam_duration_minutes: 60 },
      // Group D — Chemistry (indices 9-11)
      { course_code: "CHEM101", course_name: "General Chemistry I",  exam_duration_minutes: 60 },
      { course_code: "CHEM102", course_name: "General Chemistry II", exam_duration_minutes: 60 },
      { course_code: "CHEM201", course_name: "Organic Chemistry",    exam_duration_minutes: 75 },
      // Group E — History (indices 12-14)
      { course_code: "HIST101", course_name: "World History I",      exam_duration_minutes: 45 },
      { course_code: "HIST102", course_name: "World History II",     exam_duration_minutes: 45 },
      { course_code: "HIST201", course_name: "Modern History",       exam_duration_minutes: 60 },
    ],

    enrollment: {
      // 5 cohorts × 100 students, each takes exactly 3 courses from their isolated group.
      // Conflict graph: 5 disconnected triangles (15 total pairs, chromatic number = 3).
      cohorts: [
        { courseIndices: [0,  1,  2  ], size: 100 }, // Math students
        { courseIndices: [3,  4,  5  ], size: 100 }, // CS students
        { courseIndices: [6,  7,  8  ], size: 100 }, // Physics students
        { courseIndices: [9,  10, 11 ], size: 100 }, // Chemistry students
        { courseIndices: [12, 13, 14 ], size: 100 }, // History students
      ],
    },
  },

  // ─── STANDARD ──────────────────────────────────────────────────────────
  standard: {
    meta: {
      label: "Standard",
      description:
        "24 courses in a 4-year engineering curriculum. Bridge cohorts of " +
        "students retaking or fast-tracking between years create moderate " +
        "cross-year conflict density.",
      expectedScore: "85–94",
    },

    rooms: [
      { room_code: "A101", building: "Main Hall",   capacity: 250 },
      { room_code: "A102", building: "Main Hall",   capacity: 250 },
      { room_code: "B201", building: "Engineering", capacity: 150 },
      { room_code: "B202", building: "Engineering", capacity: 150 },
      { room_code: "B203", building: "Engineering", capacity: 150 },
      { room_code: "C301", building: "Sciences",    capacity: 100 },
      { room_code: "C302", building: "Sciences",    capacity: 100 },
      { room_code: "C303", building: "Sciences",    capacity: 100 },
      { room_code: "D401", building: "Lab Block",   capacity:  80 },
      { room_code: "D402", building: "Lab Block",   capacity:  80 },
    ],

    instructors: [
      { full_name: "Dr. Alan Ford",    email: "aford@demo.edu",    instructor_type: "assistant" },
      { full_name: "Dr. Beth Stone",   email: "bstone@demo.edu",   instructor_type: "assistant" },
      { full_name: "Dr. Chris Rivers", email: "crivers@demo.edu",  instructor_type: "assistant" },
      { full_name: "Dr. Diana Lane",   email: "dlane@demo.edu",    instructor_type: "assistant" },
      { full_name: "Dr. Edward Pine",  email: "epine@demo.edu",    instructor_type: "assistant" },
      { full_name: "Dr. Fiona Bell",   email: "fbell@demo.edu",    instructor_type: "assistant" },
      { full_name: "Dr. George Nash",  email: "gnash@demo.edu",    instructor_type: "assistant" },
      { full_name: "Dr. Helen Cross",  email: "hcross@demo.edu",   instructor_type: "assistant" },
    ],

    courses: [
      // Year 1 — Fundamentals (indices 0-5)
      { course_code: "CE101", course_name: "Introduction to Engineering",  exam_duration_minutes:  75 },
      { course_code: "CE102", course_name: "Engineering Mathematics I",    exam_duration_minutes:  90 },
      { course_code: "CE103", course_name: "Physics for Engineers",        exam_duration_minutes:  90 },
      { course_code: "CE104", course_name: "Technical Drawing",            exam_duration_minutes:  60 },
      { course_code: "CE105", course_name: "Computer Fundamentals",        exam_duration_minutes:  60 },
      { course_code: "CE106", course_name: "Engineering Chemistry",        exam_duration_minutes:  75 },
      // Year 2 — Core (indices 6-11)
      { course_code: "CE201", course_name: "Engineering Mathematics II",   exam_duration_minutes:  90 },
      { course_code: "CE202", course_name: "Mechanics of Materials",       exam_duration_minutes:  90 },
      { course_code: "CE203", course_name: "Thermodynamics",               exam_duration_minutes:  75 },
      { course_code: "CE204", course_name: "Electrical Circuits",          exam_duration_minutes:  90 },
      { course_code: "CE205", course_name: "Programming for Engineers",    exam_duration_minutes:  75 },
      { course_code: "CE206", course_name: "Fluid Mechanics",              exam_duration_minutes:  90 },
      // Year 3 — Advanced (indices 12-17)
      { course_code: "CE301", course_name: "Control Systems",              exam_duration_minutes:  90 },
      { course_code: "CE302", course_name: "Signals and Systems",          exam_duration_minutes:  75 },
      { course_code: "CE303", course_name: "Digital Electronics",          exam_duration_minutes:  75 },
      { course_code: "CE304", course_name: "Engineering Statistics",       exam_duration_minutes:  90 },
      { course_code: "CE305", course_name: "Numerical Methods",            exam_duration_minutes:  75 },
      { course_code: "CE306", course_name: "Machine Learning Basics",      exam_duration_minutes:  90 },
      // Year 4 — Specialization (indices 18-23)
      { course_code: "CE401", course_name: "Advanced Algorithms",          exam_duration_minutes:  90 },
      { course_code: "CE402", course_name: "Computer Networks",            exam_duration_minutes:  75 },
      { course_code: "CE403", course_name: "Operating Systems",            exam_duration_minutes:  90 },
      { course_code: "CE404", course_name: "Database Systems",             exam_duration_minutes:  75 },
      { course_code: "CE405", course_name: "Software Engineering",         exam_duration_minutes:  90 },
      { course_code: "CE406", course_name: "Capstone Project",             exam_duration_minutes:  60 },
    ],

    enrollment: {
      // 4 main year cohorts + 3 bridge cohorts (students retaking / accelerating).
      // Bridge cohorts cross-link adjacent years → moderate inter-year conflict density.
      // Chromatic number = 6 (within-year clique), well within 10 days — scheduler
      // can usually avoid same-day conflicts but rooms are more contested.
      cohorts: [
        { courseIndices: [0,  1,  2,  3,  4,  5  ], size: 120 }, // Year 1
        { courseIndices: [6,  7,  8,  9,  10, 11 ], size: 120 }, // Year 2
        { courseIndices: [12, 13, 14, 15, 16, 17 ], size: 120 }, // Year 3
        { courseIndices: [18, 19, 20, 21, 22, 23 ], size: 120 }, // Year 4
        { courseIndices: [3,  4,  5,  6,  7,  8  ], size:  50 }, // Year 1-2 bridge
        { courseIndices: [9,  10, 11, 12, 13, 14 ], size:  50 }, // Year 2-3 bridge
        { courseIndices: [15, 16, 17, 18, 19, 20 ], size:  50 }, // Year 3-4 bridge
      ],
    },
  },

  // ─── STRESSED ──────────────────────────────────────────────────────────
  stressed: {
    meta: {
      label: "Stressed",
      description:
        "35 courses: 11 campus-wide mandatory subjects taken by all 200 students, " +
        "plus 4 departmental groups of 6. The mandatory clique (size 11) exceeds the " +
        "10 available exam days, so at least two mandatory exams MUST land on the same " +
        "day — every student gets a guaranteed same-day conflict. Small rooms (80 cap) " +
        "force multi-room assignments and lower per-room utilization.",
      expectedScore: "65–80",
    },

    rooms: [
      { room_code: "R01", building: "Campus", capacity: 80 },
      { room_code: "R02", building: "Campus", capacity: 80 },
      { room_code: "R03", building: "Campus", capacity: 80 },
      { room_code: "R04", building: "Campus", capacity: 80 },
      { room_code: "R05", building: "Campus", capacity: 80 },
      { room_code: "R06", building: "Campus", capacity: 80 },
    ],

    instructors: [
      { full_name: "Dr. Anna Scott",   email: "ascott@demo.edu",   instructor_type: "assistant" },
      { full_name: "Dr. Ben Turner",   email: "bturner@demo.edu",  instructor_type: "assistant" },
      { full_name: "Dr. Clara Hughes", email: "chughes@demo.edu",  instructor_type: "assistant" },
      { full_name: "Dr. Dan Morris",   email: "dmorris@demo.edu",  instructor_type: "assistant" },
      { full_name: "Dr. Ella Ward",    email: "eward@demo.edu",    instructor_type: "assistant" },
      { full_name: "Dr. Fred Cole",    email: "fcole@demo.edu",    instructor_type: "assistant" },
    ],

    courses: [
      // ── Campus-wide mandatory courses — indices 0-10 ───────────────────
      // All 200 students take every one of these.
      // They form a clique of size 11 in the conflict graph.
      // With only 10 exam days, two must share a day → guaranteed same-day conflicts.
      { course_code: "UNIV101", course_name: "Critical Thinking",               exam_duration_minutes:  90 },
      { course_code: "UNIV102", course_name: "Academic Communication",          exam_duration_minutes:  75 },
      { course_code: "UNIV103", course_name: "Research Methods",                exam_duration_minutes:  90 },
      { course_code: "UNIV104", course_name: "Ethics in Technology",            exam_duration_minutes:  60 },
      { course_code: "UNIV105", course_name: "Quantitative Reasoning",          exam_duration_minutes:  90 },
      { course_code: "UNIV106", course_name: "Digital Literacy",                exam_duration_minutes:  60 },
      { course_code: "UNIV107", course_name: "Environmental Science",           exam_duration_minutes:  75 },
      { course_code: "UNIV108", course_name: "Social Sciences",                 exam_duration_minutes:  75 },
      { course_code: "UNIV109", course_name: "Health and Wellness",             exam_duration_minutes:  60 },
      { course_code: "UNIV110", course_name: "Innovation and Entrepreneurship", exam_duration_minutes:  90 },
      { course_code: "UNIV111", course_name: "Global Perspectives",             exam_duration_minutes:  75 },
      // ── Dept A — Computer Science (indices 11-16) ──────────────────────
      { course_code: "CS301", course_name: "Software Architecture",        exam_duration_minutes:  90 },
      { course_code: "CS302", course_name: "Distributed Systems",          exam_duration_minutes:  90 },
      { course_code: "CS303", course_name: "Cloud Computing",              exam_duration_minutes:  75 },
      { course_code: "CS304", course_name: "Cybersecurity Fundamentals",   exam_duration_minutes:  75 },
      { course_code: "CS305", course_name: "Artificial Intelligence",      exam_duration_minutes:  90 },
      { course_code: "CS306", course_name: "Computer Vision",              exam_duration_minutes:  90 },
      // ── Dept B — Electrical Engineering (indices 17-22) ────────────────
      { course_code: "EE301", course_name: "Power Systems",                exam_duration_minutes:  90 },
      { course_code: "EE302", course_name: "Microelectronics",             exam_duration_minutes:  75 },
      { course_code: "EE303", course_name: "Signal Processing",            exam_duration_minutes:  90 },
      { course_code: "EE304", course_name: "Embedded Systems",             exam_duration_minutes:  75 },
      { course_code: "EE305", course_name: "Renewable Energy Systems",     exam_duration_minutes:  75 },
      { course_code: "EE306", course_name: "Control Engineering",          exam_duration_minutes:  90 },
      // ── Dept C — Mechanical Engineering (indices 23-28) ────────────────
      { course_code: "ME301", course_name: "Advanced Manufacturing",       exam_duration_minutes:  90 },
      { course_code: "ME302", course_name: "Robotics",                     exam_duration_minutes:  90 },
      { course_code: "ME303", course_name: "Computational Mechanics",      exam_duration_minutes:  75 },
      { course_code: "ME304", course_name: "Heat Transfer",                exam_duration_minutes:  75 },
      { course_code: "ME305", course_name: "Vibrations",                   exam_duration_minutes:  90 },
      { course_code: "ME306", course_name: "Materials Science",            exam_duration_minutes:  75 },
      // ── Dept D — Civil Engineering (indices 29-34) ─────────────────────
      { course_code: "CIVIL301", course_name: "Structural Analysis",       exam_duration_minutes:  90 },
      { course_code: "CIVIL302", course_name: "Geotechnical Engineering",  exam_duration_minutes:  75 },
      { course_code: "CIVIL303", course_name: "Transportation Engineering",exam_duration_minutes:  90 },
      { course_code: "CIVIL304", course_name: "Construction Management",   exam_duration_minutes:  75 },
      { course_code: "CIVIL305", course_name: "Water Resources",           exam_duration_minutes:  75 },
      { course_code: "CIVIL306", course_name: "Environmental Engineering", exam_duration_minutes:  90 },
    ],

    enrollment: {
      // 4 dept cohorts × 50 students. Each cohort takes all 11 mandatory courses
      // plus their 6 departmental courses (17 courses per student total).
      // → 200 students × 11 mandatory = every mandatory course has 200 enrolled.
      // → Departmental courses have 50 students each.
      cohorts: [
        { courseIndices: [0,1,2,3,4,5,6,7,8,9,10, 11,12,13,14,15,16], size: 50 }, // CS dept
        { courseIndices: [0,1,2,3,4,5,6,7,8,9,10, 17,18,19,20,21,22], size: 50 }, // EE dept
        { courseIndices: [0,1,2,3,4,5,6,7,8,9,10, 23,24,25,26,27,28], size: 50 }, // ME dept
        { courseIndices: [0,1,2,3,4,5,6,7,8,9,10, 29,30,31,32,33,34], size: 50 }, // Civil dept
      ],
    },
  },
};

export const PRESET_NAMES = Object.keys(PRESETS);
