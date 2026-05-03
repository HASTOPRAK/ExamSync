<div align="center">

<img src="https://raw.githubusercontent.com/HASTOPRAK/ExamSync/main/frontend/src/assets/logo-dark.svg" alt="ExamSync" width="320" />

**Conflict-aware university exam scheduling — built for institutions that care about getting it right.**

[![CI](https://github.com/HASTOPRAK/ExamSync/actions/workflows/ci.yml/badge.svg)](https://github.com/HASTOPRAK/ExamSync/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-20+-brightgreen)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/postgresql-17-blue)](https://www.postgresql.org)
[![React](https://img.shields.io/badge/react-19-61dafb)](https://react.dev)

**[Live Demo](https://examsync.vercel.app)** · [Features](#features) · [Tech Stack](#tech-stack) · [Getting Started](#getting-started) · [Architecture](#architecture) · [API](#api-overview) · [Testing](#testing)

</div>

---

## What is ExamSync?

ExamSync is a full-stack exam scheduling platform for universities. It solves the hard parts automatically — detecting student conflicts, assigning rooms by capacity, distributing supervisors — while giving administrators a clean interface to manage periods, courses, and imports.

Students get a personalised schedule view based on their enrolled courses and class group (year 1–4 × first/secondary education).

---

## Features

- **Conflict-graph scheduling engine** — models student overlaps as a graph; no student ever has two exams at the same time
- **Automated room & supervisor assignment** — fills rooms by capacity, distributes instructor workload evenly
- **Schedule quality scoring** — metrics reported after every generation run
- **CSV import pipeline** — preview → validate → commit flow for students, courses, and enrollments
- **Role-based access control** — Teachers manage everything; Students see only their own schedule
- **JWT authentication** — stateless auth with bcrypt-hashed passwords
- **Class-aware student model** — students divided by academic year (1–4) and education type (first / secondary)

---

## Tech Stack

| Layer           | Technology                                   |
| --------------- | -------------------------------------------- |
| **Backend**     | Node.js 20, Express 5, ES Modules            |
| **Database**    | PostgreSQL 17, `pg` driver                   |
| **Auth**        | JWT (`jsonwebtoken`), `bcrypt`               |
| **Frontend**    | React 19, Vite 8, React Router 7             |
| **Styling**     | Tailwind CSS 4, shadcn/ui, Radix UI          |
| **HTTP Client** | Axios                                        |
| **Testing**     | Vitest (backend + frontend), Testing Library |
| **CI/CD**       | GitHub Actions                               |

---

## Architecture

```
ExamSync/
├── backend/                  # Express API
│   └── src/
│       ├── config/           # Database connection (pg pool)
│       ├── controllers/      # Request handlers
│       ├── middlewares/      # JWT auth, CSV upload
│       ├── routes/           # Route definitions
│       └── services/
│           ├── scheduler/    # 9-stage scheduling pipeline
│           └── imports/      # CSV import services
│
├── frontend/                 # React + Vite SPA
│   └── src/
│       ├── api/              # Axios instance + endpoint functions
│       ├── context/          # AuthContext (JWT state)
│       ├── components/       # Layout, UI primitives
│       └── pages/            # Route-level page components
│
└── database/
    ├── schema.sql            # Full schema (run once)
    ├── seed.sql              # Sample data (160 students, 40 courses)
    └── migrations/           # Incremental migration files
```

### Scheduling Pipeline

```
Load data → Build conflict graph → Assign time slots
         → Assign rooms → Assign supervisors
         → Validate constraints → Score quality → Save
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 17+
- npm 10+

### 1. Clone the repository

```bash
git clone https://github.com/HASTOPRAK/ExamSync.git
cd ExamSync
```

### 2. Set up the database

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE examsync;"

# Apply the schema
psql -U postgres -d examsync -f database/schema.sql

# Seed with sample data (optional)
psql -U postgres -d examsync -f database/seed.sql
```

### 3. Configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials and a strong JWT_SECRET

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env if your API runs on a different port
```

### 4. Install dependencies & run

```bash
# Backend (runs on :5000)
cd backend
npm install
npm run dev

# Frontend (runs on :5173) — open a new terminal
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — you'll land on the login page.

**Default test credentials after seeding:**
Register a teacher account at `/register`, then log in. Student accounts are created by registering with any student number from the seed data (e.g. `202611001`).

---

## Database Schema

12 tables covering the full scheduling domain:

| Table                   | Purpose                                      |
| ----------------------- | -------------------------------------------- |
| `users`                 | Auth entity — email, hashed password, role   |
| `students`              | Student records with class/education type    |
| `instructors`           | Teaching staff                               |
| `departments`           | Faculty/department groupings                 |
| `courses`               | Course catalogue with exam durations         |
| `enrollments`           | Student ↔ course registrations               |
| `exam_periods`          | Scheduling windows (e.g. Spring Finals 2026) |
| `time_slots`            | Available slots within a period              |
| `exams`                 | Exam instances (course × period)             |
| `rooms`                 | Venues with capacity                         |
| `exam_room_assignments` | Exam ↔ room allocations                      |
| `course_instructors`    | Instructor assignments per course            |

**Student number format:** `YYYY C E NNN`

- `2026` — enrollment year
- `3` — class (1–4)
- `1` — education type (1 = first, 2 = secondary)
- `009` — sequence
- Email generated automatically: `{student_no}@ogr.edu.tr`

---

## API Overview

Base URL: `http://localhost:5000/api`

All endpoints except `/auth/*` require a `Bearer` token in the `Authorization` header.

### Auth (public)

| Method | Endpoint                 | Description                  |
| ------ | ------------------------ | ---------------------------- |
| `POST` | `/auth/register/teacher` | Register a teacher account   |
| `POST` | `/auth/register/student` | Register with student number |
| `POST` | `/auth/login`            | Login → returns JWT          |
| `GET`  | `/auth/me`               | Current user + profile       |

### Management (teacher / admin)

| Method                | Endpoint                    | Description               |
| --------------------- | --------------------------- | ------------------------- |
| `GET/POST/PUT/DELETE` | `/rooms`                    | Room management           |
| `GET/POST/PUT/DELETE` | `/instructors`              | Instructor management     |
| `GET/POST/PUT/DELETE` | `/courses`                  | Course management         |
| `GET/POST/PUT/DELETE` | `/exam-periods`             | Exam period management    |
| `GET/POST/PUT/DELETE` | `/time-slots`               | Time slot management      |
| `GET/POST/PUT/DELETE` | `/exams`                    | Exam management           |
| `POST`                | `/schedules/generate`       | Run the scheduling engine |
| `GET`                 | `/schedules/:id/report`     | Schedule quality report   |
| `POST`                | `/imports/students/preview` | Preview CSV import        |
| `POST`                | `/imports/students/commit`  | Commit CSV import         |

### Student

| Method | Endpoint                | Description            |
| ------ | ----------------------- | ---------------------- |
| `GET`  | `/students/my-schedule` | Personal exam schedule |

---

## Testing

```bash
# Backend — 58 tests
cd backend && npm test

# Frontend — 12 tests
cd frontend && npm test

# With coverage
npm run test:coverage
```

Tests cover the scheduling algorithm (conflict graph, time slot assignment, scoring, validation), CSV parsing utilities, and frontend utilities.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT © 2026
