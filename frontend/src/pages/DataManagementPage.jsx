import { useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/hooks/useConfirm";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Plus, Power, Search, Trash2, UserMinus, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { getApiErrorMessage } from "@/api/axios";
import {
  assignInstructorToCourse,
  createInstructor,
  createRoom,
  deleteInstructor,
  deleteRoom,
  getAssignmentsByCourse,
  getCourses,
  getInstructors,
  getRooms,
  removeInstructorFromCourse,
  toggleRoomActive,
  updateInstructor,
  updateRoom,
} from "@/api/dataApi";
import { clearCEMockDataset } from "@/api/importsApi";

// ── Animation variants ────────────────────────────────────────────────────────

const pageContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 340, damping: 28 } },
};

// ── Initial form state ────────────────────────────────────────────────────────

const initialRoomForm = {
  room_code: "",
  building: "",
  capacity: "",
  is_active: true,
};

const initialInstructorForm = {
  full_name: "",
  email: "",
  department_id: 1,
  instructor_type: "faculty",
};

// ── Section content shell ─────────────────────────────────────────────────────

function SectionContent({ title, description, action, search, onSearch, children }) {
  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onSearch && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                className="h-8 w-44 rounded-lg border border-border bg-background pl-8 pr-3
                           text-sm text-foreground outline-none
                           placeholder:text-muted-foreground/60
                           focus:border-primary focus:ring-1 focus:ring-primary/20
                           transition-colors"
              />
            </div>
          )}
          {action}
        </div>
      </div>
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

// ── Shared table primitives ───────────────────────────────────────────────────

function Th({ children, className }) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }) {
  return (
    <td className={cn("px-4 py-2.5 text-sm", className)}>{children}</td>
  );
}

function EmptyRow({ colSpan, message }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-10 text-center text-sm text-muted-foreground"
      >
        {message}
      </td>
    </tr>
  );
}

function SkeletonRows({ cols, rows = 5 }) {
  return Array.from({ length: rows }, (_, i) => (
    <tr key={i} className="border-b border-border/40">
      {Array.from({ length: cols }, (_, j) => (
        <td key={j} className="px-4 py-3">
          <div className={`h-3.5 animate-pulse rounded bg-muted ${j === 0 ? "w-20" : j === cols - 1 ? "w-12" : "w-32"}`} />
        </td>
      ))}
    </tr>
  ));
}

// ── Left nav ──────────────────────────────────────────────────────────────────

const DATA_SECTIONS = [
  { id: "rooms",       label: "Rooms" },
  { id: "courses",     label: "Courses" },
  { id: "instructors", label: "Instructors" },
];

function LeftNav({ active, onSelect, counts }) {
  return (
    <nav className="flex w-52 shrink-0 flex-col border-r border-border p-3">
      {/* Data group */}
      <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
        Data
      </p>
      <div className="space-y-0.5">
        {DATA_SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
              active === id
                ? "bg-accent font-medium text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            {label}
            {counts[id] != null && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {counts[id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="my-3 border-t border-border" />

      {/* Assignments (separate) */}
      <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
        Relations
      </p>
      <button
        type="button"
        onClick={() => onSelect("assignments")}
        className={cn(
          "flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors",
          active === "assignments"
            ? "bg-accent font-medium text-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
      >
        Assignments
      </button>
    </nav>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DataManagementPage() {
  const shouldReduce = useReducedMotion();
  const { confirm, ConfirmDialog } = useConfirm();

  const [activeSection, setActiveSection] = useState("rooms");

  const [rooms,       setRooms]       = useState([]);
  const [courses,     setCourses]     = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [roomForm,       setRoomForm]       = useState(initialRoomForm);
  const [instructorForm, setInstructorForm] = useState(initialInstructorForm);

  const [editingRoomId,       setEditingRoomId]       = useState(null);
  const [editingInstructorId, setEditingInstructorId] = useState(null);
  const [isClearingAll,       setIsClearingAll]       = useState(false);

  const [roomSheetOpen,       setRoomSheetOpen]       = useState(false);
  const [instructorSheetOpen, setInstructorSheetOpen] = useState(false);

  const [selectedCourseId, setSelectedCourseId] = useState("");

  const [isLoading,         setIsLoading]         = useState(true);
  const [isSavingRoom,      setIsSavingRoom]      = useState(false);
  const [isSavingInstructor,setIsSavingInstructor]= useState(false);
  const [isAssigning,       setIsAssigning]       = useState(false);

  const [roomSearch,       setRoomSearch]       = useState("");
  const [courseSearch,     setCourseSearch]     = useState("");
  const [instructorSearch, setInstructorSearch] = useState("");

  // ── Filtered data ──────────────────────────────────────────────────────────

  const filteredRooms = useMemo(() => {
    const q = roomSearch.toLowerCase().trim();
    if (!q) return rooms;
    return rooms.filter(
      (r) =>
        r.room_code?.toLowerCase().includes(q) ||
        r.building?.toLowerCase().includes(q) ||
        String(r.capacity).includes(q) ||
        (r.is_active ? "active" : "inactive").includes(q),
    );
  }, [rooms, roomSearch]);

  const filteredCourses = useMemo(() => {
    const q = courseSearch.toLowerCase().trim();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.course_code?.toLowerCase().includes(q) ||
        c.course_name?.toLowerCase().includes(q) ||
        String(c.exam_duration_minutes).includes(q) ||
        String(c.student_count_cache ?? 0).includes(q),
    );
  }, [courses, courseSearch]);

  const filteredInstructors = useMemo(() => {
    const q = instructorSearch.toLowerCase().trim();
    if (!q) return instructors;
    return instructors.filter(
      (i) =>
        i.full_name?.toLowerCase().includes(q) ||
        i.email?.toLowerCase().includes(q) ||
        i.instructor_type?.toLowerCase().includes(q),
    );
  }, [instructors, instructorSearch]);

  const assignedIds = useMemo(
    () => new Set(assignments.map((a) => a.instructor_id)),
    [assignments],
  );
  const availableInstructors = useMemo(
    () => instructors.filter((i) => !assignedIds.has(i.id)),
    [instructors, assignedIds],
  );

  // ── Data loading ───────────────────────────────────────────────────────────

  async function loadBaseData() {
    try {
      setIsLoading(true);
      const [roomsRes, coursesRes, instructorsRes] = await Promise.all([
        getRooms(),
        getCourses(),
        getInstructors(),
      ]);
      const roomList       = roomsRes?.data       || [];
      const courseList     = coursesRes?.data     || [];
      const instructorList = instructorsRes?.data || [];
      setRooms(roomList);
      setCourses(courseList);
      setInstructors(instructorList);
      if (!selectedCourseId && courseList.length > 0) {
        setSelectedCourseId(String(courseList[0].id));
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load data"));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadAssignments(courseId) {
    if (!courseId) { setAssignments([]); return; }
    try {
      const response = await getAssignmentsByCourse(courseId);
      setAssignments(response?.data || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load assignments"));
    }
  }

  useEffect(() => { loadBaseData(); }, []);
  useEffect(() => { loadAssignments(selectedCourseId); }, [selectedCourseId]);

  // ── Room sheet ─────────────────────────────────────────────────────────────

  function handleRoomFormChange(e) {
    const { name, value, type, checked } = e.target;
    setRoomForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  }

  function openRoomSheet(room = null) {
    if (room) {
      setEditingRoomId(room.id);
      setRoomForm({
        room_code: room.room_code || "",
        building:  room.building  || "",
        capacity:  String(room.capacity || ""),
        is_active: Boolean(room.is_active),
      });
    } else {
      setEditingRoomId(null);
      setRoomForm(initialRoomForm);
    }
    setRoomSheetOpen(true);
  }

  function closeRoomSheet() {
    setRoomSheetOpen(false);
    setEditingRoomId(null);
    setRoomForm(initialRoomForm);
  }

  async function handleRoomSubmit(e) {
    e.preventDefault();
    try {
      setIsSavingRoom(true);
      const payload = {
        room_code: roomForm.room_code,
        building:  roomForm.building,
        capacity:  Number(roomForm.capacity),
        is_active: roomForm.is_active,
      };
      const response = editingRoomId
        ? await updateRoom(editingRoomId, payload)
        : await createRoom(payload);
      toast.success(response?.message || (editingRoomId ? "Room updated" : "Room created"));
      closeRoomSheet();
      await loadBaseData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to save room"));
    } finally {
      setIsSavingRoom(false);
    }
  }

  async function handleToggleRoom(roomId) {
    try {
      const response = await toggleRoomActive(roomId);
      toast.success(response?.message || "Room status updated");
      await loadBaseData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to toggle room"));
    }
  }

  async function handleDeleteRoom(roomId) {
    const ok = await confirm({ title: "Delete this room?", destructive: true, confirmLabel: "Delete" });
    if (!ok) return;
    try {
      const response = await deleteRoom(roomId);
      toast.success(response?.message || "Room deleted");
      if (editingRoomId === roomId) closeRoomSheet();
      await loadBaseData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete room"));
    }
  }

  // ── Instructor sheet ───────────────────────────────────────────────────────

  function handleInstructorFormChange(e) {
    const { name, value } = e.target;
    setInstructorForm((p) => ({
      ...p,
      [name]: name === "department_id" ? Number(value) : value,
    }));
  }

  function openInstructorSheet(instructor = null) {
    if (instructor) {
      setEditingInstructorId(instructor.id);
      setInstructorForm({
        full_name:       instructor.full_name       || "",
        email:           instructor.email           || "",
        department_id:   instructor.department_id   || 1,
        instructor_type: instructor.instructor_type || "faculty",
      });
    } else {
      setEditingInstructorId(null);
      setInstructorForm(initialInstructorForm);
    }
    setInstructorSheetOpen(true);
  }

  function closeInstructorSheet() {
    setInstructorSheetOpen(false);
    setEditingInstructorId(null);
    setInstructorForm(initialInstructorForm);
  }

  async function handleInstructorSubmit(e) {
    e.preventDefault();
    try {
      setIsSavingInstructor(true);
      const payload = {
        full_name:       instructorForm.full_name,
        email:           instructorForm.email || null,
        department_id:   Number(instructorForm.department_id) || 1,
        instructor_type: instructorForm.instructor_type,
      };
      const response = editingInstructorId
        ? await updateInstructor(editingInstructorId, payload)
        : await createInstructor(payload);
      toast.success(response?.message || (editingInstructorId ? "Instructor updated" : "Instructor created"));
      closeInstructorSheet();
      await loadBaseData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to save instructor"));
    } finally {
      setIsSavingInstructor(false);
    }
  }

  async function handleDeleteInstructor(instructorId) {
    const ok = await confirm({ title: "Delete this instructor?", destructive: true, confirmLabel: "Delete" });
    if (!ok) return;
    try {
      const response = await deleteInstructor(instructorId);
      toast.success(response?.message || "Instructor deleted");
      if (editingInstructorId === instructorId) closeInstructorSheet();
      await loadBaseData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete instructor"));
    }
  }

  // ── Assignments ────────────────────────────────────────────────────────────

  async function handleAssignInstructor(instructorId) {
    if (!selectedCourseId) return;
    try {
      setIsAssigning(true);
      const response = await assignInstructorToCourse({
        course_id:     Number(selectedCourseId),
        instructor_id: Number(instructorId),
      });
      toast.success(response?.message || "Instructor assigned");
      await loadAssignments(selectedCourseId);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to assign instructor"));
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleRemoveAssignment(instructorId) {
    if (!selectedCourseId) return;
    const ok = await confirm({ title: "Remove this instructor from the course?", destructive: true, confirmLabel: "Remove" });
    if (!ok) return;
    try {
      const response = await removeInstructorFromCourse(selectedCourseId, instructorId);
      toast.success(response?.message || "Assignment removed");
      await loadAssignments(selectedCourseId);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to remove assignment"));
    }
  }

  // ── Danger zone ────────────────────────────────────────────────────────────

  async function handleClearAll() {
    const ok = await confirm({
      title: "Clear all data?",
      description:
        "This will permanently delete all rooms, instructors, courses, students, and enrollments. Exam periods and schedules are not affected. This cannot be undone.",
      confirmLabel: "Clear All",
      destructive: true,
    });
    if (!ok) return;
    try {
      setIsClearingAll(true);
      const response = await clearCEMockDataset();
      toast.success(response?.message || "All data cleared");
      await loadBaseData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to clear data"));
    } finally {
      setIsClearingAll(false);
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const counts = {
    rooms:       rooms.length,
    courses:     courses.length,
    instructors: instructors.length,
  };

  const selectedCourse = useMemo(
    () => courses.find((c) => String(c.id) === String(selectedCourseId)) || null,
    [courses, selectedCourseId],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="flex flex-col gap-4"
      variants={shouldReduce ? {} : pageContainer}
      initial="hidden"
      animate="show"
    >
      {ConfirmDialog}

      {/* ── Room sheet ── */}
      <Sheet open={roomSheetOpen} onOpenChange={(open) => { if (!open) closeRoomSheet(); }}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingRoomId ? "Edit Room" : "Add Room"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleRoomSubmit} className="grid gap-4 p-4">
            <div className="grid gap-2">
              <Label htmlFor="room_code">Room Code</Label>
              <Input id="room_code" name="room_code" placeholder="A-101"
                value={roomForm.room_code} onChange={handleRoomFormChange} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="building">Building</Label>
              <Input id="building" name="building" placeholder="Engineering Block"
                value={roomForm.building} onChange={handleRoomFormChange} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input id="capacity" name="capacity" type="number" placeholder="60"
                value={roomForm.capacity} onChange={handleRoomFormChange} />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" name="is_active" checked={roomForm.is_active}
                onChange={handleRoomFormChange} className="rounded" />
              Active room
            </label>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSavingRoom}>
                {isSavingRoom ? "Saving…" : editingRoomId ? "Update Room" : "Add Room"}
              </Button>
              <SheetClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </SheetClose>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* ── Instructor sheet ── */}
      <Sheet open={instructorSheetOpen} onOpenChange={(open) => { if (!open) closeInstructorSheet(); }}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingInstructorId ? "Edit Instructor" : "Add Instructor"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleInstructorSubmit} className="grid gap-4 p-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" name="full_name" placeholder="Dr. Jane Doe"
                value={instructorForm.full_name} onChange={handleInstructorFormChange} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="jane@university.edu"
                value={instructorForm.email} onChange={handleInstructorFormChange} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="department_id">Department ID</Label>
              <Input id="department_id" name="department_id" type="number"
                value={instructorForm.department_id} onChange={handleInstructorFormChange} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="instructor_type">Type</Label>
              <select id="instructor_type" name="instructor_type"
                value={instructorForm.instructor_type}
                onChange={handleInstructorFormChange}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="faculty">Faculty (course instructor)</option>
                <option value="assistant">Assistant (exam supervisor)</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSavingInstructor}>
                {isSavingInstructor ? "Saving…" : editingInstructorId ? "Update Instructor" : "Add Instructor"}
              </Button>
              <SheetClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </SheetClose>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* ── Header ── */}
      <motion.div variants={shouldReduce ? {} : fadeUp}>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Management
        </p>
        <h2 className="mt-1 text-3xl font-semibold text-foreground">Data Records</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and edit rooms, instructors, courses, and their assignments.
        </p>
      </motion.div>

      {/* ── Main panel ── */}
      <motion.div
        variants={shouldReduce ? {} : fadeUp}
        className="flex min-h-96 overflow-hidden rounded-2xl border border-border bg-card/40"
        style={{ height: "calc(100svh - 23rem)" }}
      >
        <LeftNav active={activeSection} onSelect={setActiveSection} counts={counts} />

        {/* Right content */}
        <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          className="flex min-w-0 flex-1 flex-col"
          initial={shouldReduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduce ? {} : { opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >

          {/* ── Rooms ── */}
          {activeSection === "rooms" && (
            <SectionContent
              title="Rooms"
              description="Exam venues and their capacities."
              search={roomSearch}
              onSearch={setRoomSearch}
              action={
                <Button size="sm" onClick={() => openRoomSheet()}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Room
                </Button>
              }
            >
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-border bg-card/90 backdrop-blur-sm">
                  <tr>
                    <Th>Code</Th>
                    <Th>Building</Th>
                    <Th>Capacity</Th>
                    <Th>Status</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoading ? <SkeletonRows cols={5} /> : filteredRooms.length === 0 ? (
                    <EmptyRow colSpan={5}
                      message={roomSearch ? "No rooms match your search." : "No rooms yet. Hit Add Room to create one."} />
                  ) : (
                    filteredRooms.map((room) => (
                      <tr key={room.id} className="transition-colors hover:bg-accent/30">
                        <Td className="font-medium text-foreground">{room.room_code}</Td>
                        <Td className="text-muted-foreground">{room.building || "—"}</Td>
                        <Td>{room.capacity}</Td>
                        <Td>
                          <span className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                            room.is_active
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground",
                          )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full",
                              room.is_active ? "bg-emerald-500" : "bg-muted-foreground/50")} />
                            {room.is_active ? "Active" : "Inactive"}
                          </span>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => openRoomSheet(room)}
                              className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground border border-border hover:bg-accent hover:text-foreground transition-colors">
                              Edit
                            </button>
                            <button type="button" onClick={() => handleToggleRoom(room.id)}
                              title={room.is_active ? "Deactivate" : "Activate"}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                              <Power className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => handleDeleteRoom(room.id)}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </SectionContent>
          )}

          {/* ── Courses ── */}
          {activeSection === "courses" && (
            <SectionContent
              title="Courses"
              description="Read-only. Import courses via Data Setup."
              search={courseSearch}
              onSearch={setCourseSearch}
            >
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-border bg-card/90 backdrop-blur-sm">
                  <tr>
                    <Th>Code</Th>
                    <Th>Name</Th>
                    <Th>Duration</Th>
                    <Th>Students</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoading ? <SkeletonRows cols={4} /> : filteredCourses.length === 0 ? (
                    <EmptyRow colSpan={4}
                      message={courseSearch ? "No courses match your search." : "No courses yet. Import them via Data Setup."} />
                  ) : (
                    filteredCourses.map((course) => (
                      <tr key={course.id} className="transition-colors hover:bg-accent/30">
                        <Td className="font-medium text-foreground">{course.course_code}</Td>
                        <Td className="text-muted-foreground">{course.course_name}</Td>
                        <Td>{course.exam_duration_minutes} min</Td>
                        <Td>{course.student_count_cache ?? 0}</Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </SectionContent>
          )}

          {/* ── Instructors ── */}
          {activeSection === "instructors" && (
            <SectionContent
              title="Instructors"
              description="Faculty and exam supervisors."
              search={instructorSearch}
              onSearch={setInstructorSearch}
              action={
                <Button size="sm" onClick={() => openInstructorSheet()}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Instructor
                </Button>
              }
            >
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-border bg-card/90 backdrop-blur-sm">
                  <tr>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Type</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoading ? <SkeletonRows cols={4} /> : filteredInstructors.length === 0 ? (
                    <EmptyRow colSpan={4}
                      message={instructorSearch ? "No instructors match your search." : "No instructors yet. Hit Add Instructor to create one."} />
                  ) : (
                    filteredInstructors.map((instructor) => (
                      <tr key={instructor.id} className="transition-colors hover:bg-accent/30">
                        <Td className="font-medium text-foreground">{instructor.full_name}</Td>
                        <Td className="text-muted-foreground">{instructor.email || "—"}</Td>
                        <Td>
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                            instructor.instructor_type === "faculty"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground",
                          )}>
                            {instructor.instructor_type || "faculty"}
                          </span>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => openInstructorSheet(instructor)}
                              className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground border border-border hover:bg-accent hover:text-foreground transition-colors">
                              Edit
                            </button>
                            <button type="button" onClick={() => handleDeleteInstructor(instructor.id)}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </SectionContent>
          )}

          {/* ── Assignments ── */}
          {activeSection === "assignments" && (
            <SectionContent
              title="Assignments"
              description="Bind instructors to courses."
            >
              <div className="flex h-full">
                {/* Course list */}
                <div className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-border">
                  <p className="sticky top-0 border-b border-border bg-card/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 backdrop-blur-sm">
                    Courses
                  </p>
                  {courses.length === 0 ? (
                    <p className="px-4 py-4 text-xs text-muted-foreground">
                      No courses loaded.
                    </p>
                  ) : (
                    <div className="space-y-0.5 p-2">
                      {courses.map((course) => (
                        <button
                          key={course.id}
                          type="button"
                          onClick={() => setSelectedCourseId(String(course.id))}
                          className={cn(
                            "w-full rounded-lg px-3 py-2 text-left transition-colors",
                            String(course.id) === selectedCourseId
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                          )}
                        >
                          <p className="text-xs font-semibold">{course.course_code}</p>
                          <p className="mt-0.5 truncate text-[11px] opacity-70">
                            {course.course_name}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Two-panel: assigned | available */}
                {selectedCourse ? (
                  <div className="flex min-w-0 flex-1 divide-x divide-border overflow-hidden">
                    {/* Assigned */}
                    <div className="flex flex-1 flex-col overflow-y-auto">
                      <p className="sticky top-0 border-b border-border bg-card/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-600 backdrop-blur-sm dark:text-emerald-400">
                        Assigned · {assignments.length}
                      </p>
                      {assignments.length === 0 ? (
                        <p className="px-4 py-6 text-xs text-muted-foreground">
                          No instructors assigned yet.
                        </p>
                      ) : (
                        <div className="divide-y divide-border/50">
                          {assignments.map((a) => (
                            <div
                              key={a.instructor_id}
                              className="flex items-center justify-between gap-2 px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {a.instructor_name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {a.instructor_email || "—"}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveAssignment(a.instructor_id)}
                                title="Remove"
                                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Available */}
                    <div className="flex flex-1 flex-col overflow-y-auto">
                      <p className="sticky top-0 border-b border-border bg-card/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 backdrop-blur-sm">
                        Available · {availableInstructors.length}
                      </p>
                      {availableInstructors.length === 0 ? (
                        <p className="px-4 py-6 text-xs text-muted-foreground">
                          All instructors are assigned.
                        </p>
                      ) : (
                        <div className="divide-y divide-border/50">
                          {availableInstructors.map((i) => (
                            <div
                              key={i.id}
                              className="flex items-center justify-between gap-2 px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {i.full_name}
                                </p>
                                <p className="truncate text-xs capitalize text-muted-foreground">
                                  {i.instructor_type}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAssignInstructor(i.id)}
                                disabled={isAssigning}
                                title="Assign"
                                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      Select a course to manage assignments.
                    </p>
                  </div>
                )}
              </div>
            </SectionContent>
          )}
        </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* ── Danger Zone ── */}
      <motion.div
        variants={shouldReduce ? {} : fadeUp}
        className="flex items-center justify-between gap-4 rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4"
      >
        <div>
          <p className="text-sm font-semibold text-destructive">Danger Zone</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Permanently removes all rooms, instructors, courses, students, and enrollments.
            Exam periods and schedules are unaffected.
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="shrink-0"
          onClick={handleClearAll}
          disabled={isClearingAll}
        >
          {isClearingAll ? "Clearing…" : "Clear All Data"}
        </Button>
      </motion.div>
    </motion.div>
  );
}
