import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";

import PageSection from "@/components/common/PageSection";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
};

const TABLE_CLS = "min-w-full text-sm";
const THEAD_CLS =
  "sticky top-0 border-b border-slate-800 bg-slate-900 text-left text-slate-400";
const SCROLL_CLS = "max-h-[60vh] overflow-auto";

export default function DataManagementPage() {
  const [rooms, setRooms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [roomForm, setRoomForm] = useState(initialRoomForm);
  const [instructorForm, setInstructorForm] = useState(initialInstructorForm);

  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editingInstructorId, setEditingInstructorId] = useState(null);

  const [roomSheetOpen, setRoomSheetOpen] = useState(false);
  const [instructorSheetOpen, setInstructorSheetOpen] = useState(false);

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedInstructorId, setSelectedInstructorId] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingRoom, setIsSavingRoom] = useState(false);
  const [isSavingInstructor, setIsSavingInstructor] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  async function loadBaseData() {
    try {
      setIsLoading(true);

      const [roomsRes, coursesRes, instructorsRes] = await Promise.all([
        getRooms(),
        getCourses(),
        getInstructors(),
      ]);

      const roomList = roomsRes?.data || [];
      const courseList = Array.isArray(coursesRes) ? coursesRes : [];
      const instructorList = instructorsRes?.data || [];

      setRooms(roomList);
      setCourses(courseList);
      setInstructors(instructorList);

      if (!selectedCourseId && courseList.length > 0) {
        setSelectedCourseId(String(courseList[0].id));
      }
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Failed to load data management page"),
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadAssignments(courseId) {
    if (!courseId) {
      setAssignments([]);
      return;
    }

    try {
      const response = await getAssignmentsByCourse(courseId);
      setAssignments(response?.data || []);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Failed to load course assignments"),
      );
    }
  }

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    loadAssignments(selectedCourseId);
  }, [selectedCourseId]);

  const selectedCourse = useMemo(
    () =>
      courses.find((c) => String(c.id) === String(selectedCourseId)) || null,
    [courses, selectedCourseId],
  );

  function handleRoomFormChange(event) {
    const { name, value, type, checked } = event.target;
    setRoomForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleInstructorFormChange(event) {
    const { name, value } = event.target;
    setInstructorForm((prev) => ({
      ...prev,
      [name]: name === "department_id" ? Number(value) : value,
    }));
  }

  function openRoomSheet(room = null) {
    if (room) {
      setEditingRoomId(room.id);
      setRoomForm({
        room_code: room.room_code || "",
        building: room.building || "",
        capacity: String(room.capacity || ""),
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

  function openInstructorSheet(instructor = null) {
    if (instructor) {
      setEditingInstructorId(instructor.id);
      setInstructorForm({
        full_name: instructor.full_name || "",
        email: instructor.email || "",
        department_id: instructor.department_id || 1,
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

  async function handleRoomSubmit(event) {
    event.preventDefault();

    try {
      setIsSavingRoom(true);

      const payload = {
        room_code: roomForm.room_code,
        building: roomForm.building,
        capacity: Number(roomForm.capacity),
        is_active: roomForm.is_active,
      };

      const response = editingRoomId
        ? await updateRoom(editingRoomId, payload)
        : await createRoom(payload);

      toast.success(
        response?.message || (editingRoomId ? "Room updated" : "Room created"),
      );

      closeRoomSheet();
      await loadBaseData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to save room"));
    } finally {
      setIsSavingRoom(false);
    }
  }

  async function handleInstructorSubmit(event) {
    event.preventDefault();

    try {
      setIsSavingInstructor(true);

      const payload = {
        full_name: instructorForm.full_name,
        email: instructorForm.email || null,
        department_id: Number(instructorForm.department_id) || 1,
      };

      const response = editingInstructorId
        ? await updateInstructor(editingInstructorId, payload)
        : await createInstructor(payload);

      toast.success(
        response?.message ||
          (editingInstructorId ? "Instructor updated" : "Instructor created"),
      );

      closeInstructorSheet();
      await loadBaseData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to save instructor"));
    } finally {
      setIsSavingInstructor(false);
    }
  }

  async function handleToggleRoom(roomId) {
    try {
      const response = await toggleRoomActive(roomId);
      toast.success(response?.message || "Room status updated");
      await loadBaseData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to toggle room status"));
    }
  }

  async function handleDeleteRoom(roomId) {
    if (!window.confirm("Delete this room?")) return;

    try {
      const response = await deleteRoom(roomId);
      toast.success(response?.message || "Room deleted");
      if (editingRoomId === roomId) closeRoomSheet();
      await loadBaseData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete room"));
    }
  }

  async function handleDeleteInstructor(instructorId) {
    if (!window.confirm("Delete this instructor?")) return;

    try {
      const response = await deleteInstructor(instructorId);
      toast.success(response?.message || "Instructor deleted");
      if (editingInstructorId === instructorId) closeInstructorSheet();
      await loadBaseData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to delete instructor"));
    }
  }

  async function handleAssignInstructor(event) {
    event.preventDefault();

    if (!selectedCourseId || !selectedInstructorId) {
      toast.error("Select both a course and an instructor");
      return;
    }

    try {
      setIsAssigning(true);

      const response = await assignInstructorToCourse({
        course_id: Number(selectedCourseId),
        instructor_id: Number(selectedInstructorId),
      });

      toast.success(response?.message || "Instructor assigned");
      setSelectedInstructorId("");
      await loadAssignments(selectedCourseId);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to assign instructor"));
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleRemoveAssignment(instructorId) {
    if (!selectedCourseId) return;
    if (!window.confirm("Remove this instructor from the selected course?"))
      return;

    try {
      const response = await removeInstructorFromCourse(
        selectedCourseId,
        instructorId,
      );
      toast.success(response?.message || "Assignment removed");
      await loadAssignments(selectedCourseId);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to remove assignment"));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
          Data Management
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-white">
          Rooms, courses, instructors, assignments
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Core admin tools for the scheduling system.
        </p>
      </div>

      {/* ── Room sheet ─────────────────────────────────────── */}
      <Sheet
        open={roomSheetOpen}
        onOpenChange={(open) => { if (!open) closeRoomSheet(); }}
      >
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingRoomId ? "Edit Room" : "Add Room"}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleRoomSubmit} className="grid gap-4 p-4">
            <div className="grid gap-2">
              <Label htmlFor="room_code">Room Code</Label>
              <Input
                id="room_code"
                name="room_code"
                value={roomForm.room_code}
                onChange={handleRoomFormChange}
                placeholder="A-101"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="building">Building</Label>
              <Input
                id="building"
                name="building"
                value={roomForm.building}
                onChange={handleRoomFormChange}
                placeholder="Engineering Block"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                value={roomForm.capacity}
                onChange={handleRoomFormChange}
                placeholder="60"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                name="is_active"
                checked={roomForm.is_active}
                onChange={handleRoomFormChange}
              />
              Active room
            </label>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSavingRoom}>
                {isSavingRoom ? "Saving..." : editingRoomId ? "Update Room" : "Add Room"}
              </Button>
              <SheetClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </SheetClose>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* ── Instructor sheet ───────────────────────────────── */}
      <Sheet
        open={instructorSheetOpen}
        onOpenChange={(open) => { if (!open) closeInstructorSheet(); }}
      >
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingInstructorId ? "Edit Instructor" : "Add Instructor"}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleInstructorSubmit} className="grid gap-4 p-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                name="full_name"
                value={instructorForm.full_name}
                onChange={handleInstructorFormChange}
                placeholder="Dr. Jane Doe"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={instructorForm.email}
                onChange={handleInstructorFormChange}
                placeholder="jane@university.edu"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="department_id">Department ID</Label>
              <Input
                id="department_id"
                name="department_id"
                type="number"
                value={instructorForm.department_id}
                onChange={handleInstructorFormChange}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSavingInstructor}>
                {isSavingInstructor
                  ? "Saving..."
                  : editingInstructorId
                    ? "Update Instructor"
                    : "Add Instructor"}
              </Button>
              <SheetClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </SheetClose>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <Tabs defaultValue="rooms" className="space-y-4">
        <TabsList className="bg-slate-900">
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="instructors">Instructors</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>

        {/* Rooms */}
        <TabsContent value="rooms">
          <PageSection
            title="Rooms"
            description="Current room inventory from the backend."
            action={
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() => openRoomSheet()}
                title="Add room"
              >
                <PlusIcon />
              </Button>
            }
          >
            <div className={SCROLL_CLS}>
              <table className={TABLE_CLS}>
                <thead className={THEAD_CLS}>
                  <tr>
                    <th className="px-3 py-3 font-medium">Code</th>
                    <th className="px-3 py-3 font-medium">Building</th>
                    <th className="px-3 py-3 font-medium">Capacity</th>
                    <th className="px-3 py-3 font-medium">Active</th>
                    <th className="px-3 py-3 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {!isLoading && rooms.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-slate-500">
                        No rooms found. Hit + to add one.
                      </td>
                    </tr>
                  ) : (
                    rooms.map((room) => (
                      <tr key={room.id} className="border-b border-slate-900">
                        <td className="px-3 py-3 font-medium">
                          {room.room_code}
                        </td>
                        <td className="px-3 py-3">{room.building || "—"}</td>
                        <td className="px-3 py-3">{room.capacity}</td>
                        <td className="px-3 py-3">
                          {room.is_active ? "Yes" : "No"}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => openRoomSheet(room)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleToggleRoom(room.id)}
                            >
                              Toggle
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteRoom(room.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </PageSection>
        </TabsContent>

        {/* Courses */}
        <TabsContent value="courses">
          <PageSection
            title="Courses"
            description="Read-only course list. Import courses via the Imports page."
          >
            <div className={SCROLL_CLS}>
              <table className={TABLE_CLS}>
                <thead className={THEAD_CLS}>
                  <tr>
                    <th className="px-3 py-3 font-medium">Code</th>
                    <th className="px-3 py-3 font-medium">Name</th>
                    <th className="px-3 py-3 font-medium">Duration</th>
                    <th className="px-3 py-3 font-medium">Students</th>
                  </tr>
                </thead>

                <tbody>
                  {!isLoading && courses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-slate-500">
                        No courses found.
                      </td>
                    </tr>
                  ) : (
                    courses.map((course) => (
                      <tr key={course.id} className="border-b border-slate-900">
                        <td className="px-3 py-3 font-medium">
                          {course.course_code}
                        </td>
                        <td className="px-3 py-3">{course.course_name}</td>
                        <td className="px-3 py-3">
                          {course.exam_duration_minutes} min
                        </td>
                        <td className="px-3 py-3">
                          {course.student_count_cache ?? 0}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </PageSection>
        </TabsContent>

        {/* Instructors */}
        <TabsContent value="instructors">
          <PageSection
            title="Instructors"
            description="Current instructors from the backend."
            action={
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() => openInstructorSheet()}
                title="Add instructor"
              >
                <PlusIcon />
              </Button>
            }
          >
            <div className={SCROLL_CLS}>
              <table className={TABLE_CLS}>
                <thead className={THEAD_CLS}>
                  <tr>
                    <th className="px-3 py-3 font-medium">Name</th>
                    <th className="px-3 py-3 font-medium">Email</th>
                    <th className="px-3 py-3 font-medium">Dept. ID</th>
                    <th className="px-3 py-3 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {!isLoading && instructors.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-slate-500">
                        No instructors found. Hit + to add one.
                      </td>
                    </tr>
                  ) : (
                    instructors.map((instructor) => (
                      <tr
                        key={instructor.id}
                        className="border-b border-slate-900"
                      >
                        <td className="px-3 py-3 font-medium">
                          {instructor.full_name}
                        </td>
                        <td className="px-3 py-3">
                          {instructor.email || "—"}
                        </td>
                        <td className="px-3 py-3">{instructor.department_id}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => openInstructorSheet(instructor)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                handleDeleteInstructor(instructor.id)
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </PageSection>
        </TabsContent>

        {/* Assignments */}
        <TabsContent value="assignments" className="space-y-6">
          <PageSection
            title="Assign instructor to course"
            description="Select a course, pick an instructor, and bind them."
          >
            <form
              onSubmit={handleAssignInstructor}
              className="grid gap-4 lg:grid-cols-3"
            >
              <div className="grid gap-2">
                <Label htmlFor="selectedCourseId">Course</Label>
                <select
                  id="selectedCourseId"
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="h-10 rounded-md border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100"
                >
                  <option value="">Select course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.course_code} — {course.course_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="selectedInstructorId">Instructor</Label>
                <select
                  id="selectedInstructorId"
                  value={selectedInstructorId}
                  onChange={(e) => setSelectedInstructorId(e.target.value)}
                  className="h-10 rounded-md border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100"
                >
                  <option value="">Select instructor</option>
                  {instructors.map((instructor) => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <Button type="submit" disabled={isAssigning}>
                  {isAssigning ? "Assigning..." : "Assign"}
                </Button>
              </div>
            </form>
          </PageSection>

          <PageSection
            title="Assignments"
            description={
              selectedCourse
                ? `${selectedCourse.course_code} — ${selectedCourse.course_name}`
                : "Select a course above to see its assignments."
            }
          >
            <div className={SCROLL_CLS}>
              <table className={TABLE_CLS}>
                <thead className={THEAD_CLS}>
                  <tr>
                    <th className="px-3 py-3 font-medium">Instructor</th>
                    <th className="px-3 py-3 font-medium">Email</th>
                    <th className="px-3 py-3 font-medium">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {assignments.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-slate-500">
                        No instructors assigned to this course yet.
                      </td>
                    </tr>
                  ) : (
                    assignments.map((assignment) => (
                      <tr
                        key={`${assignment.course_id}-${assignment.instructor_id}`}
                        className="border-b border-slate-900"
                      >
                        <td className="px-3 py-3 font-medium">
                          {assignment.instructor_name}
                        </td>
                        <td className="px-3 py-3">
                          {assignment.instructor_email || "—"}
                        </td>
                        <td className="px-3 py-3">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              handleRemoveAssignment(assignment.instructor_id)
                            }
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </PageSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
