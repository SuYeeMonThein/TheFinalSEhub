import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronRight,
  GraduationCap,
  Layers,
  Search,
  Users,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { useCourses } from "@/hooks/use-courses";
import {
  fetchCourseProjects,
  fetchCourseRoster,
  deleteCourseRosterEntry,
  type RosterEntryDto,
} from "@/services/courseApi";
import { updateProjectStatus } from "@/services/projectApi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface AdvisorCourse {
  id: string;
  code: string;
  title: string;
  semester: string;
  year: string;
  adviseeCount: number;
  submissionsDue: number;
  lastUpdated: string;
  status: "On Track" | "Needs Review" | "At Risk";
  projects: Array<{
    id: string;
    title: string;
    teamName: string;
    summary: string;
    status: string;
    lastTouchpoint: string;
    progress: number;
    nextMilestone: string;
  }>;
}

interface AdvisorCoursePlaceholderProps {
  authToken: string | null;
  onViewProject: (projectId: string) => void;
  onCreateRubric: () => void;
}

export const AdvisorCoursePlaceholder = ({
  authToken,
  onViewProject,
  onCreateRubric,
}: AdvisorCoursePlaceholderProps) => {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [courseProjects, setCourseProjects] = useState<any[]>([]);
  const [allCourseProjects, setAllCourseProjects] = useState<
    Record<string, any[]>
  >({});
  const [projectFeedback, setProjectFeedback] = useState<
    Record<string, string>
  >({});
  const [isStudentsDialogOpen, setIsStudentsDialogOpen] = useState(false);
  const [studentsDialogCourse, setStudentsDialogCourse] =
    useState<AdvisorCourse | null>(null);
  const [courseStudents, setCourseStudents] = useState<RosterEntryDto[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set(),
  );
  const [isRemovingStudents, setIsRemovingStudents] = useState(false);
  const { data: coursesData = [], isLoading } = useCourses(authToken);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Mutation for approving projects
  const approveMutation = useMutation({
    mutationFn: async ({ projectId }: { projectId: number }) => {
      if (!authToken) throw new Error("No auth token");
      return updateProjectStatus(projectId, "Approved", authToken);
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Project Approved",
        description:
          "The project has been approved successfully and will appear in the archive.",
      });
      // Clear feedback for this project
      setProjectFeedback((prev) => {
        const updated = { ...prev };
        delete updated[variables.projectId.toString()];
        return updated;
      });
      // Refetch course projects to update the list
      if (selectedCourseId && authToken) {
        fetchCourseProjects(selectedCourseId, authToken).then((projects) => {
          setCourseProjects(projects);
          setAllCourseProjects((prev) => ({
            ...prev,
            [selectedCourseId]: projects,
          }));
        });
      }
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => {
      toast({
        title: "Approval Failed",
        description:
          error instanceof Error ? error.message : "Failed to approve project",
        variant: "destructive",
      });
    },
  });

  // Mutation for denying projects
  const denyMutation = useMutation({
    mutationFn: async ({ projectId }: { projectId: number }) => {
      if (!authToken) throw new Error("No auth token");
      return updateProjectStatus(projectId, "Rejected", authToken);
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Project Denied",
        description: "The project has been denied.",
        variant: "destructive",
      });
      // Clear feedback for this project
      setProjectFeedback((prev) => {
        const updated = { ...prev };
        delete updated[variables.projectId.toString()];
        return updated;
      });
      // Refetch course projects to update the list
      if (selectedCourseId && authToken) {
        fetchCourseProjects(selectedCourseId, authToken).then((projects) => {
          setCourseProjects(projects);
          setAllCourseProjects((prev) => ({
            ...prev,
            [selectedCourseId]: projects,
          }));
        });
      }
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => {
      toast({
        title: "Deny Failed",
        description:
          error instanceof Error ? error.message : "Failed to deny project",
        variant: "destructive",
      });
    },
  });

  const handleApproveProject = (projectId: string) => {
    approveMutation.mutate({ projectId: Number(projectId) });
  };

  const handleDenyProject = (projectId: string) => {
    denyMutation.mutate({ projectId: Number(projectId) });
  };

  const handleFeedbackChange = (projectId: string, feedback: string) => {
    setProjectFeedback((prev) => ({
      ...prev,
      [projectId]: feedback,
    }));
  };

  // Fetch projects for all courses to show counts
  useEffect(() => {
    if (coursesData.length > 0 && authToken) {
      coursesData.forEach((course) => {
        fetchCourseProjects(course.id, authToken)
          .then((projects) => {
            setAllCourseProjects((prev) => ({
              ...prev,
              [course.id]: projects,
            }));
          })
          .catch((error) =>
            console.error(
              `Error fetching projects for course ${course.id}:`,
              error,
            ),
          );
      });
    }
  }, [coursesData, authToken]);

  // Fetch projects when a course is selected
  useEffect(() => {
    if (selectedCourseId && authToken) {
      fetchCourseProjects(selectedCourseId, authToken)
        .then((projects) => setCourseProjects(projects))
        .catch((error) =>
          console.error("Error fetching course projects:", error),
        );
    }
  }, [selectedCourseId, authToken]);

  const courses = useMemo<AdvisorCourse[]>(() => {
    // Convert database courses to advisor course format
    return coursesData.map((course) => {
      const projects =
        selectedCourseId === course.id
          ? courseProjects
          : allCourseProjects[course.id] || [];

      return {
        id: course.id,
        code: course.courseCode,
        title: course.courseCode,
        semester: course.semester,
        year: course.year,
        adviseeCount: (allCourseProjects[course.id] || []).length,
        submissionsDue: (allCourseProjects[course.id] || []).filter(
          (p: any) => p?.status === "Under Review",
        ).length,
        lastUpdated: "Recently",
        status: "On Track" as const,
        projects: projects
          .filter((p: any) => p && p.id)
          .map((p: any) => ({
            id: p.id?.toString() || "",
            title: p.title || "Untitled Project",
            teamName: p.teamName || "Team",
            summary: p.description || "",
            status: p.status || "Under Review",
            lastTouchpoint:
              p.submissionDate || new Date().toISOString().split("T")[0],
            progress:
              p.status === "Approved"
                ? 100
                : p.status === "Under Review"
                  ? 50
                  : 0,
            nextMilestone:
              p.status === "Under Review" ? "Awaiting review" : "Completed",
          })),
      };
    });
  }, [coursesData, courseProjects, selectedCourseId, allCourseProjects]);

  const selectedCourse =
    courses.find((course) => course.id === selectedCourseId) || null;

  const filteredCourses = courses.filter((course) => {
    const haystack = `${course.code} ${course.title}`.toLowerCase();
    return haystack.includes(searchTerm.toLowerCase());
  });

  const statusBadges: Record<AdvisorCourse["status"], string> = {
    "On Track": "bg-emerald-100 text-emerald-700",
    "Needs Review": "bg-amber-100 text-amber-700",
    "At Risk": "bg-rose-100 text-rose-700",
  };

  const handleCourseSelect = (courseId: string) => {
    setSelectedCourseId(courseId);
    console.log(`Advisor Course placeholder course selected: ${courseId}`);
  };

  const handleProjectAction = (projectId: string) => {
    onViewProject(projectId);
  };

  const handleViewStudents = async (course: AdvisorCourse) => {
    if (!authToken) {
      toast({
        title: "Not authenticated",
        description: "Please log in again to view students.",
        variant: "destructive",
      });
      return;
    }

    setStudentsDialogCourse(course);
    setSelectedStudentIds(new Set());
    setIsStudentsDialogOpen(true);
    setIsLoadingStudents(true);

    try {
      const roster = await fetchCourseRoster(course.id, authToken);
      setCourseStudents(roster);
    } catch (error) {
      toast({
        title: "Failed to load students",
        description:
          error instanceof Error
            ? error.message
            : "Could not load student roster.",
        variant: "destructive",
      });
      setCourseStudents([]);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const toggleSelectedStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const toggleSelectAllStudents = () => {
    if (selectedStudentIds.size === courseStudents.length) {
      setSelectedStudentIds(new Set());
      return;
    }

    setSelectedStudentIds(new Set(courseStudents.map((student) => student.student_id)));
  };

  const handleRemoveStudents = async (studentIds: string[]) => {
    if (!studentsDialogCourse) {
      toast({
        title: "No course selected",
        description: "Please reopen the student list and try again.",
        variant: "destructive",
      });
      return;
    }

    if (!authToken) {
      toast({
        title: "Not authenticated",
        description: "Please log in again to remove students.",
        variant: "destructive",
      });
      return;
    }

    if (studentIds.length === 0) {
      toast({
        title: "No students selected",
        description: "Select at least one student to remove.",
        variant: "destructive",
      });
      return;
    }

    setIsRemovingStudents(true);
    const removedStudentIds: string[] = [];
    const errors: string[] = [];

    for (const studentId of studentIds) {
      try {
        await deleteCourseRosterEntry(studentsDialogCourse.id, studentId, authToken);
        removedStudentIds.push(studentId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to remove student";
        errors.push(`${studentId}: ${message}`);
      }
    }

    if (removedStudentIds.length > 0) {
      const removedIdSet = new Set(removedStudentIds);
      setCourseStudents((prev) =>
        prev.filter((student) => !removedIdSet.has(student.student_id)),
      );
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        removedStudentIds.forEach((id) => next.delete(id));
        return next;
      });

      toast({
        title: "Students removed",
        description: `Removed ${removedStudentIds.length} student(s) from this course.`,
      });
    }

    if (errors.length > 0) {
      toast({
        title: "Some removals failed",
        description: errors.join("; "),
        variant: "destructive",
      });
    }

    setIsRemovingStudents(false);
  };

  if (selectedCourse) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          className="pl-0"
          onClick={() => setSelectedCourseId(null)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Courses
        </Button>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <GraduationCap className="h-6 w-6 text-blue-600" />
                {selectedCourse.title}
              </CardTitle>
              <Button onClick={onCreateRubric} className="w-full md:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Create Rubric
              </Button>
            </div>
            <CardDescription>
              {selectedCourse.code} • Semester {selectedCourse.semester} •{" "}
              {selectedCourse.year}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Active Advisees</p>
              <p className="text-2xl font-semibold">
                {selectedCourse.adviseeCount}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Submissions Due</p>
              <p className="text-2xl font-semibold">
                {selectedCourse.submissionsDue}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="text-2xl font-semibold">
                {selectedCourse.lastUpdated}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Project Cohort
            </CardTitle>
            <CardDescription>
              Quick view of advisee submissions and their current milestones.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {selectedCourse.projects.length === 0 && (
              <div className="col-span-full rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                No projects yet. Once advisees submit work, status cards will
                appear here.
              </div>
            )}
            {selectedCourse.projects.map((project) => (
              <Card key={project.id} className="border shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                    {project.title}
                  </CardTitle>
                  <CardDescription>{project.teamName}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {project.summary}
                  </p>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant="secondary">Status: {project.status}</Badge>
                    <Badge variant="outline">
                      Progress: {project.progress}%
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>Last touchpoint: {project.lastTouchpoint}</p>
                    <p>Next milestone: {project.nextMilestone}</p>
                  </div>

                  {project.status !== "Approved" &&
                    project.status !== "Rejected" && (
                      <div className="space-y-4 pt-4 border-t">
                        <div>
                          <h4 className="text-base font-semibold mb-2">
                            Submit Feedback
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            Your Feedback
                          </p>
                          <Textarea
                            placeholder="Share your thoughts about the project..."
                            value={projectFeedback[project.id] || ""}
                            onChange={(e) =>
                              handleFeedbackChange(project.id, e.target.value)
                            }
                            className="min-h-[120px] resize-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            className="w-full bg-red-500 hover:bg-red-600 text-white"
                            onClick={() => handleDenyProject(project.id)}
                            disabled={denyMutation.isPending}
                          >
                            <XCircle className="mr-2 h-5 w-5" />
                            Deny
                          </Button>
                          <Button
                            className="w-full bg-green-500 hover:bg-green-600 text-white"
                            onClick={() => handleApproveProject(project.id)}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle className="mr-2 h-5 w-5" />
                            Approved
                          </Button>
                        </div>
                      </div>
                    )}

                  {(project.status === "Approved" ||
                    project.status === "Rejected") && (
                    <div className="pt-4 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleProjectAction(project.id)}
                      >
                        View Details
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">Advisor Courses</h1>
        <p className="text-muted-foreground">
          Quick placeholder view so you can see how advisee courses and projects
          will eventually surface here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filter Courses
          </CardTitle>
          <CardDescription>
            Search by course code or course title.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Advisee Courses
          </CardTitle>
          <CardDescription>
            Placeholder dataset with quick stats so navigation feels real.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead className="hidden md:table-cell">Semester</TableHead>
                <TableHead>Total Project</TableHead>
                <TableHead>Due Soon</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCourses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell>
                    <div className="font-medium">{course.code}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Semester {course.semester} • {course.year}
                    </div>
                  </TableCell>
                  <TableCell>{course.adviseeCount}</TableCell>
                  <TableCell>{course.submissionsDue}</TableCell>
                  <TableCell>
                    <Badge className={statusBadges[course.status]}>
                      {course.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewStudents(course)}
                      >
                        View students
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCourseSelect(course.id)}
                      >
                        View projects <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={isStudentsDialogOpen}
        onOpenChange={(open) => {
          setIsStudentsDialogOpen(open);
          if (!open) {
            setSelectedStudentIds(new Set());
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Students
              {studentsDialogCourse ? ` - ${studentsDialogCourse.code}` : ""}
            </DialogTitle>
            <DialogDescription>
              Students merged from CSV upload and manual assignment.
            </DialogDescription>
          </DialogHeader>

          {isLoadingStudents ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading student roster...
            </div>
          ) : courseStudents.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No students found for this course yet.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {selectedStudentIds.size} selected
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={selectedStudentIds.size === 0 || isRemovingStudents}
                  onClick={() => {
                    void handleRemoveStudents(Array.from(selectedStudentIds));
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isRemovingStudents
                    ? "Removing..."
                    : `Remove ${selectedStudentIds.size} Selected`}
                </Button>
              </div>

              <div className="max-h-[420px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={
                            courseStudents.length > 0 &&
                            selectedStudentIds.size === courseStudents.length
                          }
                          onCheckedChange={toggleSelectAllStudents}
                        />
                      </TableHead>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courseStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedStudentIds.has(student.student_id)}
                            onCheckedChange={() =>
                              toggleSelectedStudent(student.student_id)
                            }
                          />
                        </TableCell>
                        <TableCell>{student.student_id}</TableCell>
                        <TableCell>{student.name}</TableCell>
                        <TableCell>{student.email}</TableCell>
                        <TableCell>{student.year || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                            disabled={isRemovingStudents}
                            onClick={() => {
                              void handleRemoveStudents([student.student_id]);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
