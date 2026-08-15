import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  Download,
  Users,
  AlertCircle,
  CheckCircle,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCourses } from "@/hooks/use-courses";
import {
  fetchCourseRoster,
  upsertCourseRoster,
  deleteCourseRosterEntry,
  UpsertRosterInputDto,
} from "@/services/courseApi";
import { parseRosterCsv } from "@/utils/rosterCsv";

interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "coordinator" | "advisor";
}

interface CourseRow {
  id: string;
  courseCode: string;
  semester: string;
  year: string;
}

interface StudentRecord {
  id: string;
  studentId: string;
  name: string;
  email: string;
  year: string;
  status: "active" | "enrolled" | "error";
  errorMessage?: string;
}

interface StudentRosterUploadProps {
  user: User;
  authToken?: string | null;
}

export const StudentRosterUpload = ({
  user,
  authToken,
}: StudentRosterUploadProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [uploadedStudents, setUploadedStudents] = useState<StudentRecord[]>([]);
  const [rosterByCourse, setRosterByCourse] = useState<
    Record<string, StudentRecord[]>
  >({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{
    total: number;
    successful: number;
    failed: number;
  } | null>(null);
  const [resultsByCourse, setResultsByCourse] = useState<
    Record<string, { total: number; successful: number; failed: number }>
  >({});
  const [newStudentsByCourse, setNewStudentsByCourse] = useState<
    Record<string, string[]>
  >({});

  // Load courses from backend
  const { data: courseData = [] } = useCourses(authToken || null);
  const courses: CourseRow[] = courseData.map((c) => ({
    id: c.id,
    courseCode: c.courseCode,
    semester: c.semester,
    year: c.year,
  }));

  // Auto-select first course for convenience
  useEffect(() => {
    if (!selectedCourse && courses.length > 0) {
      setSelectedCourse(courses[0].id);
    }
  }, [courses, selectedCourse]);

  // Fetch roster when a course is selected
  useEffect(() => {
    const load = async () => {
      if (!selectedCourse || !authToken) {
        setUploadedStudents([]);
        setUploadResults(null);
        return;
      }
      try {
        const roster = await fetchCourseRoster(selectedCourse, authToken);
        const mapped: StudentRecord[] = roster.map((r) => ({
          id: String(r.id),
          studentId: r.student_id,
          name: r.name,
          email: r.email,
          year: r.year ?? "",
          status: "enrolled",
        }));
        setRosterByCourse((prev) => ({ ...prev, [selectedCourse]: mapped }));
        setUploadedStudents(mapped);
        setUploadResults({
          total: mapped.length,
          successful: mapped.length,
          failed: 0,
        });
        setNewStudentsByCourse((prev) => ({
          ...prev,
          [selectedCourse]: [],
        }));
      } catch (err) {
        setUploadedStudents([]);
        setUploadResults(null);
      }
    };
    load();
  }, [selectedCourse, authToken]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedCourse) {
      toast({
        title: "Course Required",
        description: "Please select a course before uploading the roster.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const students: StudentRecord[] = parseRosterCsv(text).map((student) => ({
          ...student,
          status: student.status,
        }));

        // Persist to backend
        persistUpload(students);
      } catch (error) {
        toast({
          title: "Upload Error",
          description:
            error instanceof Error ? error.message : "Failed to parse the file",
          variant: "destructive",
        });
      }
    };

    reader.readAsText(file);
  };

  const persistUpload = async (students: StudentRecord[]) => {
    try {
      setIsUploading(true);
      setUploadProgress(10);

      const toSend: UpsertRosterInputDto[] = students
        .filter((s) => s.status !== "error")
        .map((s) => ({
          studentId: s.studentId,
          name: s.name,
          email: s.email,
          year: s.year,
        }));

      if (!authToken || !selectedCourse) {
        throw new Error("Missing course selection or auth token.");
      }

      setUploadProgress(40);
      const saved = await upsertCourseRoster(selectedCourse, toSend, authToken);
      setUploadProgress(80);

      const mapped: StudentRecord[] = saved.roster.map((r) => ({
        id: String(r.id),
        studentId: r.student_id,
        name: r.name,
        email: r.email,
        year: r.year ?? "",
        status: "enrolled",
      }));

      setNewStudentsByCourse((prev) => ({
        ...prev,
        [selectedCourse]: saved.addedStudentIds,
      }));

      setRosterByCourse((prev) => ({ ...prev, [selectedCourse]: mapped }));
      setUploadedStudents(mapped);
      const successful = mapped.length;
      const failed = students.length - toSend.length;
      const result = { total: students.length, successful, failed };
      setUploadResults(result);
      setResultsByCourse((prev) => ({ ...prev, [selectedCourse]: result }));

      // Send sign-in link emails to students
      try {
        const API_BASE =
          import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";
        const emailResponse = await fetch(`${API_BASE}/students/bulk-upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            students: toSend.map((s) => ({
              name: s.name,
              email: s.email,
              rollNumber: s.studentId,
              year: s.year,
            })),
            sendEmails: true,
          }),
        });

        if (emailResponse.ok) {
          const emailResult = await emailResponse.json();
          toast({
            title: "Emails Sent! 📧",
            description: `Sign-in links sent to ${emailResult.emailResults?.success || 0} students.`,
          });
        }
      } catch (emailError) {
        console.error("Failed to send emails:", emailError);
        // Don't fail the whole upload if emails fail
      }

      toast({
        title: "Upload Complete",
        description: `Successfully enrolled ${successful} students. ${failed} failed.`,
      });
    } catch (e) {
      toast({
        title: "Upload Failed",
        description: e instanceof Error ? e.message : "Unable to save roster.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(100);
    }
  };

  const downloadTemplate = () => {
    const csvContent =
      "id,course_id,student_id,name,email,year,created_at\n" +
      "1,4,STU401,Alex Morgan,alex.morgan4@university.edu,2024,2026-04-20T10:05:12.000Z\n" +
      "2,4,STU402,Jamie Lee,jamie.lee4@university.edu,2024,2026-04-20T10:05:12.000Z";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = "student_roster_template.csv";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const removeStudent = async (studentId: string) => {
    if (!selectedCourse || !authToken) return;
    try {
      await deleteCourseRosterEntry(selectedCourse, studentId, authToken);
      const updated = (rosterByCourse[selectedCourse] ?? []).filter(
        (s) => s.studentId !== studentId,
      );
      setRosterByCourse((prev) => ({ ...prev, [selectedCourse]: updated }));
      setUploadedStudents(updated);
      setNewStudentsByCourse((prev) => ({
        ...prev,
        [selectedCourse]: (prev[selectedCourse] ?? []).filter(
          (id) => id !== studentId,
        ),
      }));
      setResultsByCourse((prev) => ({
        ...prev,
        [selectedCourse]: {
          total: updated.length,
          successful: updated.length,
          failed: 0,
        },
      }));
    } catch (e) {
      toast({
        title: "Delete Failed",
        description: e instanceof Error ? e.message : "Unable to delete entry.",
        variant: "destructive",
      });
    }
  };

  // When course changes, show its roster and results (or placeholders)
  useEffect(() => {
    if (!selectedCourse) {
      setUploadedStudents([]);
      setUploadResults(null);
      return;
    }
    const list = rosterByCourse[selectedCourse] ?? [];
    setUploadedStudents(list);
    setUploadResults(resultsByCourse[selectedCourse] ?? null);
  }, [selectedCourse, rosterByCourse, resultsByCourse]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "enrolled":
        return <Badge className="bg-green-100 text-green-800">Enrolled</Badge>;
      case "error":
        return <Badge className="bg-red-100 text-red-800">Error</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Student Roster Upload
        </h1>
        <p className="text-gray-600 mt-1">
          Upload student rosters for courses each semester
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Roster
              </CardTitle>
              <CardDescription>
                Select a course and upload the student roster file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="course-select">Select Course</Label>
                <Select
                  value={selectedCourse}
                  onValueChange={setSelectedCourse}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.courseCode} • Semester {course.semester}{" "}
                        {course.year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="file-upload">Upload CSV File</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  disabled={!selectedCourse}
                />
              </div>

              {isUploading && (
                <div className="space-y-2">
                  <Label>Upload Progress</Label>
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-sm text-gray-600">
                    {uploadProgress}% complete
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                onClick={downloadTemplate}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </CardContent>
          </Card>

          {uploadResults && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Upload Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total Students:</span>
                    <span className="font-medium">{uploadResults.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Successfully Enrolled:</span>
                    <span className="font-medium text-green-600">
                      {uploadResults.successful}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Failed:</span>
                    <span className="font-medium text-red-600">
                      {uploadResults.failed}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>CSV Format:</strong> The file should contain columns for
              Student ID, Name, Email, and Year. Use the template above for the
              correct format.
            </AlertDescription>
          </Alert>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Uploaded Students
                {uploadedStudents.length > 0 && (
                  <Badge variant="secondary">{uploadedStudents.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Review and manage uploaded student data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {uploadedStudents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No students uploaded yet</p>
                  <p className="text-sm">
                    Select a course and upload a CSV file to get started
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadedStudents.map((student) => {
                      const isNew = (newStudentsByCourse[selectedCourse] ?? []).includes(
                        student.studentId,
                      );
                      return (
                      <TableRow
                        key={student.id}
                        className={isNew ? "bg-green-50" : undefined}
                      >
                        <TableCell className="font-medium">
                          {student.studentId}
                        </TableCell>
                        <TableCell>{student.name}</TableCell>
                        <TableCell>{student.email}</TableCell>
                        <TableCell>{student.year}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {getStatusBadge(student.status)}
                            {student.errorMessage && (
                              <p className="text-xs text-red-600">
                                {student.errorMessage}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeStudent(student.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
