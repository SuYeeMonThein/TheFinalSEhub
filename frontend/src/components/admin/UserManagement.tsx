import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  User,
  Upload,
  FileText,
  Download,
  Eye,
  EyeOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  ApiError,
  CreateUserRequest,
  UpdateUserRequest,
  assignStudentToCourses,
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from "@/services/userApi";
import { CourseDto, fetchCourses } from "@/services/courseApi";

interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "coordinator" | "advisor";
  studentId?: string;
  advisorName?: string;
  password?: string;
  semester?: number;
  year?: number;
  graduated?: boolean;
  status?: "Active" | "Inactive";
}

interface UserManagementProps {
  user: User;
}

export const UserManagement = ({ user }: UserManagementProps) => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isCsvUploadOpen, setIsCsvUploadOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<CourseDto[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [assigningUser, setAssigningUser] = useState<User | null>(null);
  const [bulkAssignUserIds, setBulkAssignUserIds] = useState<string[]>([]);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(
    new Set(),
  );
  const [isAssigningCourses, setIsAssigningCourses] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "",
    password: "",
    studentId: "",
    advisorName: "",
  });

  const filteredUsers = users.filter((u) => {
    const name = (u.name ?? "").toLowerCase();
    const email = (u.email ?? "").toLowerCase();
    const matchesSearch =
      name.includes(searchTerm.toLowerCase()) ||
      email.includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const selectedStudentUsers = users.filter(
    (u) => selectedUsers.has(u.id) && u.role === "student",
  );
  const selectedStudentCount = selectedStudentUsers.length;
  const selectedNonStudentCount = selectedUsers.size - selectedStudentCount;

  const getRoleColor = (role: string) => {
    switch (role) {
      case "advisor":
        return "bg-green-100 text-green-800";
      case "coordinator":
        return "bg-blue-100 text-blue-800";
      case "student":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getAuthToken = () =>
    localStorage.getItem("firebaseAuthToken") ??
    localStorage.getItem("authToken");

  const fetchUsers = useCallback(async () => {
    if (user.role !== "coordinator") {
      return;
    }

    const token = getAuthToken();

    if (!token) {
      toast({
        title: "Authentication required",
        description: "Please sign in again to load users.",
        variant: "destructive",
      });
      setUsers([]);
      return;
    }

    setIsLoadingUsers(true);

    try {
      const apiUsers = await listUsers(token);
      setUsers(
        apiUsers.map((apiUser) => ({
          id: String(apiUser.id),
          name: apiUser.name,
          email: apiUser.email,
          role: apiUser.role,
          status: "Active",
        })),
      );
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Failed to load users.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [toast, user.role]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const fetchCoordinatorCourses = useCallback(async () => {
    if (user.role !== "coordinator") {
      return;
    }

    const token = getAuthToken();

    if (!token) {
      return;
    }

    setIsLoadingCourses(true);

    try {
      const courses = await fetchCourses(token);
      setAvailableCourses(courses);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load coordinator courses.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      setAvailableCourses([]);
    } finally {
      setIsLoadingCourses(false);
    }
  }, [toast, user.role]);

  useEffect(() => {
    void fetchCoordinatorCourses();
  }, [fetchCoordinatorCourses]);

  const handleAddUser = async (): Promise<void> => {
    if (!newUser.name || !newUser.email || !newUser.role || !newUser.password) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const token = getAuthToken();

    if (!token) {
      toast({
        title: "Authentication required",
        description: "Please sign in again to add a user.",
        variant: "destructive",
      });
      return;
    }

    const payload: CreateUserRequest = {
      name: newUser.name.trim(),
      email: newUser.email.trim(),
      password: newUser.password,
      role: newUser.role as CreateUserRequest["role"],
    };

    setIsSavingUser(true);

    try {
      await createUser(payload, token);

      await fetchUsers();
      setNewUser({
        name: "",
        email: "",
        role: "",
        password: "",
        studentId: "",
        advisorName: "",
      });
      setShowPassword(false);
      setIsAddUserOpen(false);
      setEditingUser(null);

      toast({
        title: "Success",
        description: "User added successfully",
      });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Failed to add user. Please try again.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const numericId = Number(userId);

    if (!Number.isInteger(numericId) || numericId <= 0) {
      toast({
        title: "Error",
        description: "Invalid user selected for deletion.",
        variant: "destructive",
      });
      return;
    }

    const token = getAuthToken();

    if (!token) {
      toast({
        title: "Authentication required",
        description: "Please sign in again to delete a user.",
        variant: "destructive",
      });
      return;
    }

    try {
      await deleteUser(numericId, token);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSelectedUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });

      if (editingUser?.id === userId) {
        setEditingUser(null);
        setNewUser({
          name: "",
          email: "",
          role: "",
          password: "",
          studentId: "",
          advisorName: "",
        });
      }

      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Failed to delete user.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) return;

    const token = getAuthToken();
    if (!token) {
      toast({
        title: "Authentication required",
        description: "Please sign in again to delete users.",
        variant: "destructive",
      });
      return;
    }

    setIsDeletingBulk(true);
    let successCount = 0;
    const errors: string[] = [];

    for (const userId of selectedUsers) {
      const numericId = Number(userId);
      if (!Number.isInteger(numericId) || numericId <= 0) {
        errors.push(`Invalid user ID: ${userId}`);
        continue;
      }
      try {
        await deleteUser(numericId, token);
        successCount++;
      } catch (error) {
        const message =
          error instanceof ApiError ? error.message : "Unknown error";
        errors.push(`User ${userId}: ${message}`);
      }
    }

    if (successCount > 0) {
      await fetchUsers();
      toast({
        title: "Success",
        description: `Deleted ${successCount} user(s) successfully.`,
      });
    }

    if (errors.length > 0) {
      toast({
        title: "Some deletions failed",
        description: errors.join("; "),
        variant: "destructive",
      });
    }

    setSelectedUsers(new Set());
    setIsDeletingBulk(false);
  };

  const handleEditUser = (userToEdit: any) => {
    setEditingUser(userToEdit);
    setNewUser({
      name: userToEdit.name,
      email: userToEdit.email,
      role: userToEdit.role,
      password: userToEdit.password || "",
      studentId: userToEdit.studentId || "",
      advisorName: userToEdit.advisorName || "",
    });
  };

  const handleUpdateUser = async () => {
    if (!editingUser) {
      toast({
        title: "Error",
        description: "No user selected for editing.",
        variant: "destructive",
      });
      return;
    }

    if (!newUser.name || !newUser.email || !newUser.role) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const token = getAuthToken();

    if (!token) {
      toast({
        title: "Authentication required",
        description: "Please sign in again to update a user.",
        variant: "destructive",
      });
      return;
    }

    const updates: UpdateUserRequest = {};
    const trimmedName = newUser.name.trim();
    const trimmedEmail = newUser.email.trim();
    const trimmedPassword = newUser.password.trim();

    if (trimmedName && trimmedName !== editingUser.name) {
      updates.name = trimmedName;
    }

    if (trimmedEmail && trimmedEmail !== editingUser.email) {
      updates.email = trimmedEmail;
    }

    if (newUser.role && newUser.role !== editingUser.role) {
      updates.role = newUser.role as UpdateUserRequest["role"];
    }

    if (trimmedPassword.length > 0) {
      updates.password = trimmedPassword;
    }

    if (Object.keys(updates).length === 0) {
      toast({
        title: "No changes detected",
        description: "Update at least one field before saving.",
      });
      return;
    }

    const numericId = Number(editingUser.id);

    if (!Number.isInteger(numericId) || numericId <= 0) {
      toast({
        title: "Error",
        description: "Invalid user selected for updating.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingUser(true);

    try {
      await updateUser(numericId, updates, token);
      await fetchUsers();

      setEditingUser(null);
      setIsAddUserOpen(false);
      setShowPassword(false);
      setNewUser({
        name: "",
        email: "",
        role: "",
        password: "",
        studentId: "",
        advisorName: "",
      });

      toast({
        title: "Success",
        description: "User updated successfully",
      });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Failed to update user. Please try again.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleOpenAssignDialog = (studentUser: User) => {
    setBulkAssignUserIds([]);
    setAssigningUser(studentUser);
    setSelectedCourseIds(new Set());
    setIsAssignDialogOpen(true);
  };

  const handleOpenBulkAssignDialog = () => {
    const studentIds = selectedStudentUsers.map((u) => u.id);

    if (studentIds.length === 0) {
      toast({
        title: "No students selected",
        description: "Select at least one student to assign courses.",
        variant: "destructive",
      });
      return;
    }

    setAssigningUser(null);
    setBulkAssignUserIds(studentIds);
    setSelectedCourseIds(new Set());
    setIsAssignDialogOpen(true);

    if (selectedNonStudentCount > 0) {
      toast({
        title: "Heads up",
        description: `${selectedNonStudentCount} non-student user(s) will be skipped.`,
      });
    }
  };

  const toggleSelectedCourse = (courseId: string) => {
    setSelectedCourseIds((prev) => {
      const next = new Set(prev);

      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }

      return next;
    });
  };

  const handleAssignCourses = async () => {
    if (!assigningUser && bulkAssignUserIds.length === 0) {
      toast({
        title: "Error",
        description: "No student selected for assignment.",
        variant: "destructive",
      });
      return;
    }

    const token = getAuthToken();

    if (!token) {
      toast({
        title: "Authentication required",
        description: "Please sign in again to assign courses.",
        variant: "destructive",
      });
      return;
    }

    if (selectedCourseIds.size === 0) {
      toast({
        title: "No course selected",
        description: "Select at least one course.",
        variant: "destructive",
      });
      return;
    }

    const courseIds = Array.from(selectedCourseIds).map((id) => Number(id));

    setIsAssigningCourses(true);

    try {
      if (assigningUser) {
        const numericId = Number(assigningUser.id);

        if (!Number.isInteger(numericId) || numericId <= 0) {
          toast({
            title: "Error",
            description: "Invalid student selected.",
            variant: "destructive",
          });
          return;
        }

        const assignedCourseIds = await assignStudentToCourses(
          numericId,
          courseIds,
          token,
        );

        setIsAssignDialogOpen(false);
        setAssigningUser(null);
        setBulkAssignUserIds([]);
        setSelectedCourseIds(new Set());

        toast({
          title: "Success",
          description: `Assigned ${assigningUser.name} to ${assignedCourseIds.length} course(s).`,
        });
        return;
      }

      const studentsToAssign = users.filter(
        (u) => bulkAssignUserIds.includes(u.id) && u.role === "student",
      );

      if (studentsToAssign.length === 0) {
        toast({
          title: "No students selected",
          description: "Select at least one student to assign courses.",
          variant: "destructive",
        });
        return;
      }

      let successCount = 0;
      const errors: string[] = [];

      for (const studentUser of studentsToAssign) {
        const numericId = Number(studentUser.id);

        if (!Number.isInteger(numericId) || numericId <= 0) {
          errors.push(`${studentUser.name}: invalid user id`);
          continue;
        }

        try {
          await assignStudentToCourses(numericId, courseIds, token);
          successCount += 1;
        } catch (error) {
          const message =
            error instanceof ApiError ? error.message : "assignment failed";
          errors.push(`${studentUser.name}: ${message}`);
        }
      }

      setIsAssignDialogOpen(false);
      setAssigningUser(null);
      setBulkAssignUserIds([]);
      setSelectedCourseIds(new Set());

      if (successCount > 0) {
        toast({
          title: "Success",
          description: `Assigned ${successCount} student(s) to ${courseIds.length} course(s).`,
        });
      }

      if (errors.length > 0) {
        toast({
          title: "Some assignments failed",
          description: errors.join("; "),
          variant: "destructive",
        });
      }
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Failed to assign student to courses.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsAssigningCourses(false);
    }
  };

  const validateStudentId = (studentId: string): boolean => {
    // Student ID should start with 6831503 and be followed by 3 digits
    const pattern = /^6831503\d{3}$/;
    return pattern.test(studentId);
  };

  const handleCsvFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/csv") {
      setCsvFile(file);
    } else {
      toast({
        title: "Error",
        description: "Please select a valid CSV file",
        variant: "destructive",
      });
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) {
      toast({
        title: "Error",
        description: "Please select a CSV file first",
        variant: "destructive",
      });
      return;
    }

    try {
      const text = await csvFile.text();
      const lines = text.split("\n").filter((line) => line.trim() !== "");

      if (lines.length < 2) {
        toast({
          title: "Error",
          description:
            "CSV file must contain headers and at least one data row",
          variant: "destructive",
        });
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const requiredHeaders = ["student_id", "name", "email"];

      const missingHeaders = requiredHeaders.filter(
        (h) => !headers.includes(h),
      );
      if (missingHeaders.length > 0) {
        toast({
          title: "Error",
          description: `Missing required columns: ${missingHeaders.join(", ")}`,
          variant: "destructive",
        });
        return;
      }

      const studentIdIndex = headers.indexOf("student_id");
      const nameIndex = headers.indexOf("name");
      const emailIndex = headers.indexOf("email");

      const newStudents = [];
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        const studentId = values[studentIdIndex];
        const name = values[nameIndex];
        const email = values[emailIndex];

        if (!studentId || !name || !email) {
          errors.push(`Row ${i + 1}: Missing required data`);
          continue;
        }

        if (!validateStudentId(studentId)) {
          errors.push(
            `Row ${i + 1}: Invalid student ID format (should be 6831503xxx)`,
          );
          continue;
        }

        // Check if email already exists
        const emailExists = users.some(
          (u) => u.email.toLowerCase() === email.toLowerCase(),
        );
        if (emailExists) {
          errors.push(`Row ${i + 1}: Email ${email} already exists`);
          continue;
        }

        newStudents.push({
          id: studentId,
          name: name,
          email: email,
          role: "student" as const,
          status: "Active",
        });
      }

      if (errors.length > 0) {
        toast({
          title: "Import Errors",
          description: `${errors.length} errors found. Check console for details.`,
          variant: "destructive",
        });
        console.error("CSV Import Errors:", errors);
      }

      if (newStudents.length > 0) {
        setUsers([...users, ...newStudents]);
        toast({
          title: "Success",
          description: `Successfully imported ${newStudents.length} students`,
        });
      }

      setCsvFile(null);
      setIsCsvUploadOpen(false);

      // Reset file input
      const fileInput = document.getElementById(
        "csv-file-input",
      ) as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process CSV file",
        variant: "destructive",
      });
      console.error("CSV processing error:", error);
    }
  };

  const generateSampleCsv = () => {
    const sampleData = `student_id,name,email
6831503001,John Smith,john.smith@university.edu
6831503002,Jane Doe,jane.doe@university.edu
6831503003,Bob Johnson,bob.johnson@university.edu`;

    const blob = new Blob([sampleData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (user.role !== "coordinator") {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-lg">Access Denied</div>
        <p className="text-gray-500 mt-2">
          Only Program Coordinators can access user management
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">User Management</h2>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={generateSampleCsv}>
            <Download className="w-4 h-4 mr-2" />
            Download Template
          </Button>
          <Button variant="outline" onClick={() => setIsCsvUploadOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import Students
          </Button>
          <Dialog
            open={isAddUserOpen || !!editingUser}
            onOpenChange={(open) => {
              if (!open) {
                setIsAddUserOpen(false);
                setEditingUser(null);
                setNewUser({
                  name: "",
                  email: "",
                  role: "",
                  password: "",
                  studentId: "",
                  advisorName: "",
                });
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setIsAddUserOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add New User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? "Edit User" : "Add New User"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={newUser.name}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value) =>
                      setNewUser((prev) => ({ ...prev, role: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="advisor">Advisor</SelectItem>
                      <SelectItem value="coordinator">Coordinator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newUser.role === "student" && (
                  <>
                    <div>
                      <Label htmlFor="studentId">Student ID</Label>
                      <Input
                        id="studentId"
                        value={newUser.studentId}
                        onChange={(e) =>
                          setNewUser((prev) => ({
                            ...prev,
                            studentId: e.target.value,
                          }))
                        }
                        placeholder="Enter student id"
                      />
                    </div>
                    <div>
                      <Label htmlFor="advisorName">Advisor Name</Label>
                      <Input
                        id="advisorName"
                        value={newUser.advisorName}
                        onChange={(e) =>
                          setNewUser((prev) => ({
                            ...prev,
                            advisorName: e.target.value,
                          }))
                        }
                        placeholder="Enter Advisor name"
                      />
                    </div>
                  </>
                )}
                <div>
                  <Label htmlFor="password">Password *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={newUser.password}
                      onChange={(e) =>
                        setNewUser((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      placeholder={
                        editingUser
                          ? "Enter new password"
                          : "Enter initial password"
                      }
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddUserOpen(false);
                      setEditingUser(null);
                      setNewUser({
                        name: "",
                        email: "",
                        role: "",
                        password: "",
                        studentId: "",
                        advisorName: "",
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={isSavingUser}
                    onClick={() => {
                      if (editingUser) {
                        void handleUpdateUser();
                      } else {
                        void handleAddUser();
                      }
                    }}
                  >
                    {editingUser
                      ? "Update User"
                      : isSavingUser
                        ? "Adding..."
                        : "Add User"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* CSV Upload Dialog */}
      <Dialog open={isCsvUploadOpen} onOpenChange={setIsCsvUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Students from CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              <p className="mb-2">
                Upload a CSV file with the following format:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Headers: student_id, name, email</li>
                <li>Student ID format: 6831503xxx (where xxx are 3 digits)</li>
                <li>
                  Example: 6831503001, John Smith, john.smith@university.edu
                </li>
              </ul>
            </div>

            <div>
              <Label htmlFor="csv-file-input">Select CSV File</Label>
              <Input
                id="csv-file-input"
                type="file"
                accept=".csv"
                onChange={handleCsvFileChange}
                className="mt-1"
              />
            </div>

            {csvFile && (
              <div className="flex items-center space-x-2 text-sm text-green-600">
                <FileText className="w-4 h-4" />
                <span>Selected: {csvFile.name}</span>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCsvUploadOpen(false);
                  setCsvFile(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCsvUpload} disabled={!csvFile}>
                Import Students
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAssignDialogOpen}
        onOpenChange={(open) => {
          setIsAssignDialogOpen(open);
          if (!open) {
            setAssigningUser(null);
            setBulkAssignUserIds([]);
            setSelectedCourseIds(new Set());
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {assigningUser
                ? `Assign Student To Courses - ${assigningUser.name}`
                : `Assign Students To Courses - ${bulkAssignUserIds.length} selected`}
            </DialogTitle>
          </DialogHeader>

          {isLoadingCourses ? (
            <div className="py-8 text-sm text-center text-gray-500">
              Loading courses...
            </div>
          ) : availableCourses.length === 0 ? (
            <div className="py-8 text-sm text-center text-gray-500">
              No courses available for assignment.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-h-80 overflow-y-auto border rounded-lg p-3 space-y-2">
                {availableCourses.map((course) => (
                  <label
                    key={course.id}
                    className="flex items-center gap-3 rounded-md border p-3 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedCourseIds.has(course.id)}
                      onCheckedChange={() => toggleSelectedCourse(course.id)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{course.courseCode}</div>
                      <div className="text-xs text-gray-500">
                        Semester {course.semester} / {course.year}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAssignDialogOpen(false);
                    setAssigningUser(null);
                    setBulkAssignUserIds([]);
                    setSelectedCourseIds(new Set());
                  }}
                >
                  Cancel
                </Button>
                <Button
                  disabled={isAssigningCourses || selectedCourseIds.size === 0}
                  onClick={() => {
                    void handleAssignCourses();
                  }}
                >
                  {isAssigningCourses
                    ? "Assigning..."
                    : assigningUser
                      ? "Assign"
                      : "Assign Selected Students"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>All Users</CardTitle>
            <div className="text-sm text-gray-500">
              {isLoadingUsers
                ? "Loading users..."
                : `${filteredUsers.length} user(s) found`}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="flex space-x-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="student">Students</SelectItem>
                <SelectItem value="advisor">Advisors</SelectItem>
                <SelectItem value="coordinator">Coordinators</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk actions bar */}
          {selectedUsers.size > 0 && (
            <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
              <span className="text-sm font-medium text-red-800">
                {selectedUsers.size} user(s) selected
                {selectedStudentCount > 0
                  ? ` (${selectedStudentCount} student(s) assignable)`
                  : ""}
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedUsers(new Set())}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isDeletingBulk}
                  onClick={() => {
                    void handleBulkDelete();
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  {isDeletingBulk
                    ? "Deleting..."
                    : `Delete ${selectedUsers.size} User(s)`}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isAssigningCourses || selectedStudentCount === 0}
                  onClick={() => {
                    handleOpenBulkAssignDialog();
                  }}
                >
                  {isAssigningCourses
                    ? "Assigning..."
                    : `Assign ${selectedStudentCount} Student(s)`}
                </Button>
              </div>
            </div>
          )}

          {/* Users Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      filteredUsers.length > 0 &&
                      selectedUsers.size === filteredUsers.length
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Student ID</TableHead>
                <TableHead>Advisor</TableHead>
                <TableHead>Password</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoadingUsers &&
                filteredUsers.map((u) => (
                  <TableRow
                    key={u.id}
                    className={selectedUsers.has(u.id) ? "bg-red-50" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedUsers.has(u.id)}
                        onCheckedChange={() => toggleSelectUser(u.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span>{u.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge className={getRoleColor(u.role)}>
                        {u.role
                          ? u.role.charAt(0).toUpperCase() + u.role.slice(1)
                          : "Unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell>{u.studentId || "-"}</TableCell>
                    <TableCell>{u.advisorName || "-"}</TableCell>
                    <TableCell>{u.password ? "********" : "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          className="order-1"
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditUser(u)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          className="order-2 text-red-600 hover:text-red-800"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void handleDeleteUser(u.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                        {u.role === "student" && (
                          <Button
                            className="order-3"
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenAssignDialog(u)}
                          >
                            Assign
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>

          {!isLoadingUsers && filteredUsers.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 text-lg">No users found</div>
              <p className="text-gray-500 mt-2">
                Try adjusting your search criteria
              </p>
            </div>
          )}
          {isLoadingUsers && (
            <div className="text-center py-8">
              <div className="text-gray-400 text-lg">Loading users...</div>
              <p className="text-gray-500 mt-2">
                Fetching the latest user list from the server
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
