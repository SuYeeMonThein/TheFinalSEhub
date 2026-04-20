import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  User,
  Calendar,
  Award,
  FileText,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjectDto, ProjectStatus } from "@/services/projectApi";
import {
  assignProjectRubric,
  updateProjectGrade,
  updateProjectFeedback,
  updateProjectStatus,
  downloadProjectFile,
} from "@/services/projectApi";
import { fetchRubrics, type RubricDto } from "@/services/rubricApi";

interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "coordinator" | "advisor";
}

type ExtendedProject = ProjectDto & {
  grade?: string | null;
  feedback?: {
    advisor?: string;
    coordinator?: string;
    status?: string;
  };
  course?: string | null;
};

const GRADE_OPTIONS = ["A", "B+", "B", "C+", "C", "D+", "D", "F"] as const;
type GradeValue = (typeof GRADE_OPTIONS)[number];

const isGradeValue = (value: string): value is GradeValue => {
  return GRADE_OPTIONS.includes(value as GradeValue);
};

interface ProjectDetailViewProps {
  projectId: string;
  user: User;
  onBack: () => void;
  projects?: ExtendedProject[];
  onProjectUpdate?: (projects: ExtendedProject[]) => void;
  isArchiveView?: boolean;
  authToken?: string | null;
  onProjectRefresh?: () => void;
}

export const ProjectDetailView = ({
  projectId,
  user,
  onBack,
  projects,
  onProjectUpdate,
  isArchiveView = false,
  authToken,
  onProjectRefresh,
}: ProjectDetailViewProps) => {
  const { toast } = useToast();
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [gradeSelection, setGradeSelection] = useState<string>("");
  const [newComment, setNewComment] = useState("");
  const [isAssignRubricDialogOpen, setIsAssignRubricDialogOpen] =
    useState(false);
  const [isViewRubricDialogOpen, setIsViewRubricDialogOpen] = useState(false);
  const [selectedRubricId, setSelectedRubricId] = useState<string>("");
  const queryClient = useQueryClient();

  // Find the correct project by ID
  const project = projects?.find((p) => p.id.toString() === projectId);

  if (!project) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Project not found
            </h2>
            <p className="text-sm text-gray-600">
              This project may have been removed or is still loading.
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            No project details available.
          </CardContent>
        </Card>
      </div>
    );
  }

  const canAdvisorSubmitFeedback =
    user.role === "advisor" &&
    !isArchiveView &&
    project.status === "Under Review";
  const canCoordinatorSubmitFeedback =
    user.role === "coordinator" && !isArchiveView;

  const { data: rubricDtos = [], isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["rubrics", authToken],
    queryFn: async () => {
      if (!authToken) {
        return [] as RubricDto[];
      }
      return fetchRubrics(authToken);
    },
    enabled: Boolean(authToken),
  });

  const activeRubrics = rubricDtos.filter((rubric) => rubric.is_active);
  const assignedRubricId =
    typeof project.rubricId === "number" ? project.rubricId : null;
  const assignedRubric = rubricDtos.find(
    (rubric) => rubric.id === assignedRubricId,
  );

  const assignRubricMutation = useMutation({
    mutationFn: async (rubricId: number) => {
      if (!authToken) {
        throw new Error("Missing authentication token.");
      }

      return assignProjectRubric(project.id, rubricId, authToken);
    },
    onSuccess: (updatedProject) => {
      queryClient.setQueryData<ProjectDto[] | undefined>(
        ["projects", authToken],
        (existing) => {
          if (!existing) {
            return existing;
          }

          return existing.map((candidate) =>
            candidate.id === updatedProject.id
              ? { ...candidate, rubricId: updatedProject.rubricId ?? null }
              : candidate,
          );
        },
      );

      if (projects && onProjectUpdate) {
        const updatedList = projects.map((candidate) =>
          candidate.id === updatedProject.id
            ? { ...candidate, rubricId: updatedProject.rubricId ?? null }
            : candidate,
        );
        onProjectUpdate(updatedList);
      }

      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onProjectRefresh?.();

      const rubricName =
        activeRubrics.find(
          (rubric) => rubric.id === (updatedProject.rubricId ?? 0),
        )?.name ?? "Rubric";

      setIsAssignRubricDialogOpen(false);
      toast({
        title: "Rubric assigned",
        description: `${rubricName} has been assigned to this project.`,
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to assign rubric.";
      toast({
        title: "Assignment failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleOpenAssignRubricDialog = () => {
    setSelectedRubricId(assignedRubricId ? String(assignedRubricId) : "");
    setIsAssignRubricDialogOpen(true);
  };

  const handleAssignRubric = () => {
    if (!selectedRubricId) {
      toast({
        title: "Select a rubric",
        description: "Please choose a rubric before assigning.",
        variant: "destructive",
      });
      return;
    }

    assignRubricMutation.mutate(Number(selectedRubricId));
  };

  useEffect(() => {
    setGradeSelection(project.grade ?? "");
  }, [project.id, project.grade]);

  useEffect(() => {
    if (user.role === "advisor") {
      setReviewFeedback(project.feedback?.advisor ?? "");
    } else if (user.role === "coordinator") {
      setReviewFeedback(project.feedback?.coordinator ?? "");
    } else {
      setReviewFeedback("");
    }
    // Only re-initialize when switching projects or roles, not after saving
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, user.role]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-green-100 text-green-800";
      case "Under Review":
        return "bg-yellow-100 text-yellow-800";
      case "Draft":
        return "bg-red-100 text-red-800";
      case "Rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusDisplayName = (status: string) => {
    return status === "Draft" ? "Deny" : status;
  };

  const statusMutation = useMutation<ProjectDto, Error, ProjectStatus>({
    mutationFn: async (status: ProjectStatus) => {
      if (!authToken) {
        throw new Error("Missing authentication token.");
      }
      return updateProjectStatus(project.id, status, authToken);
    },
    onSuccess: (updatedProject) => {
      queryClient.setQueryData<ProjectDto[] | undefined>(
        ["projects", authToken],
        (existing) => {
          if (!existing) {
            return existing;
          }
          return existing.map((candidate) =>
            candidate.id === updatedProject.id
              ? { ...candidate, status: updatedProject.status }
              : candidate,
          );
        },
      );

      if (projects && onProjectUpdate) {
        const updatedList = projects.map((candidate) =>
          candidate.id === updatedProject.id
            ? { ...candidate, status: updatedProject.status }
            : candidate,
        );
        onProjectUpdate(updatedList);
      }

      // Ensure any other views refetch fresh data
      queryClient.invalidateQueries({ queryKey: ["projects"] });

      onProjectRefresh?.();

      toast({
        title: "Project status updated",
        description: `Project has been ${updatedProject.status.toLowerCase()}.`,
      });

      // Navigate back after successful update
      onBack();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update project status.";
      toast({
        title: "Status update failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleReviewAction = async (action: "approve" | "deny") => {
    if (action === "approve") {
      const confirmComplete = window.confirm(
        "Are you sure you want to approve this project? This will make it visible in the archive.",
      );
      if (!confirmComplete) {
        return;
      }
    } else {
      if (!reviewFeedback.trim() && !newComment.trim()) {
        toast({
          title: "Feedback required",
          description: "Please provide feedback before rejecting.",
          variant: "destructive",
        });
        return;
      }
    }

    const updatedStatus: ProjectStatus =
      action === "approve" ? "Approved" : "Rejected";
    statusMutation.mutate(updatedStatus);
  };

  const gradeMutation = useMutation<ProjectDto, Error, GradeValue>({
    mutationFn: async (grade: GradeValue) => {
      if (!authToken) {
        throw new Error("Missing authentication token.");
      }

      return updateProjectGrade(project.id, grade, authToken);
    },
    onSuccess: (updatedProject) => {
      const resolvedGrade = updatedProject.grade ?? gradeSelection;
      setGradeSelection(resolvedGrade ?? "");

      queryClient.setQueryData<ProjectDto[] | undefined>(
        ["projects", authToken],
        (existing) => {
          if (!existing) {
            return existing;
          }

          return existing.map((candidate) =>
            candidate.id === updatedProject.id
              ? { ...candidate, grade: updatedProject.grade ?? null }
              : candidate,
          );
        },
      );

      if (projects && onProjectUpdate) {
        const updatedList = projects.map((candidate) =>
          candidate.id === updatedProject.id
            ? { ...candidate, grade: updatedProject.grade ?? null }
            : candidate,
        );
        onProjectUpdate(updatedList);
      }

      onProjectRefresh?.();

      toast({
        title: "Grade saved",
        description: `${updatedProject.title} is now graded ${resolvedGrade}.`,
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to save grade.";
      toast({
        title: "Grade not saved",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleGradeSubmit = () => {
    if (!gradeSelection) {
      toast({
        title: "Select a grade",
        description: "Choose a letter grade before saving.",
        variant: "destructive",
      });
      return;
    }

    if (!isGradeValue(gradeSelection)) {
      toast({
        title: "Unsupported grade",
        description: "Please choose one of the available grade options.",
        variant: "destructive",
      });
      return;
    }

    if (project.grade === gradeSelection) {
      toast({
        title: "No changes",
        description: "This project already has the selected grade.",
        variant: "default",
      });
      return;
    }

    gradeMutation.mutate(gradeSelection as GradeValue);
  };

  // Check if user can see and participate in comments
  const canAccessComments = () => {
    // Project students can access
    if (user.role === "student" && project.students.includes(user.name)) {
      return true;
    }

    // Project advisor can access
    if (
      user.role === "advisor" &&
      (project.advisor === user.name || project.advisorEmail === user.email)
    ) {
      return true;
    }

    // Coordinators can access (they oversee all projects)
    if (user.role === "coordinator") {
      return true;
    }

    return false;
  };

  // Fetch comments
  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ["comments", project.id],
    queryFn: async () => {
      if (!authToken) return [];
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5001"}/comments/${project.id}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );
      if (!response.ok) throw new Error("Failed to fetch comments");
      const data = await response.json();
      // Backend returns { comments: [...] } with nested user objects — flatten them
      const rawComments = data.comments || data || [];
      return rawComments.map((c: any) => ({
        ...c,
        user_name: c.user_name || c.user?.name || "Unknown User",
        user_email: c.user_email || c.user?.email || "",
        user_role: c.user_role || c.user?.role || "user",
      }));
    },
    enabled: !!authToken && canAccessComments(),
  });

  // Post comment mutation
  const postCommentMutation = useMutation({
    mutationFn: async (commentText: string) => {
      if (!authToken) throw new Error("No auth token");
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5001"}/comments/${project.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ comment: commentText }),
        },
      );
      if (!response.ok) throw new Error("Failed to post comment");
      return response.json();
    },
    onSuccess: () => {
      refetchComments();
      setNewComment("");
      toast({
        title: "Comment posted",
        description: "Your comment has been added.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to post comment.",
        variant: "destructive",
      });
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      if (!authToken) throw new Error("No auth token");
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5001"}/comments/${commentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );
      if (!response.ok) throw new Error("Failed to delete comment");
    },
    onSuccess: () => {
      refetchComments();
      toast({
        title: "Comment deleted",
        description: "The comment has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete comment.",
        variant: "destructive",
      });
    },
  });

  const handleCommentSubmit = () => {
    if (!newComment.trim()) {
      toast({
        title: "Comment required",
        description: "Please enter a comment.",
        variant: "destructive",
      });
      return;
    }
    postCommentMutation.mutate(newComment.trim());
  };

  const handleDeleteComment = (commentId: number) => {
    if (confirm("Are you sure you want to delete this comment?")) {
      deleteCommentMutation.mutate(commentId);
    }
  };

  const formatCommentTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const feedbackMutation = useMutation<ProjectDto, Error, string>({
    mutationFn: async (feedbackText: string) => {
      if (!authToken) {
        throw new Error("Missing authentication token.");
      }

      return updateProjectFeedback(project.id, feedbackText, authToken);
    },
    onSuccess: (updatedProject) => {
      const nextFeedback = updatedProject.feedback ?? {};
      const enrichedFeedback = {
        ...project.feedback,
        ...nextFeedback,
      };

      queryClient.setQueryData<ProjectDto[] | undefined>(
        ["projects", authToken],
        (existing) => {
          if (!existing) {
            return existing;
          }

          return existing.map((candidate) =>
            candidate.id === updatedProject.id
              ? { ...candidate, feedback: enrichedFeedback }
              : candidate,
          );
        },
      );

      if (projects && onProjectUpdate) {
        const updatedList = projects.map((candidate) =>
          candidate.id === updatedProject.id
            ? { ...candidate, feedback: enrichedFeedback }
            : candidate,
        );
        onProjectUpdate(updatedList);
      }

      setReviewFeedback("");
      onProjectRefresh?.();

      toast({
        title: "Feedback saved",
        description: "Feedback has been updated.",
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to save feedback.";
      toast({
        title: "Feedback not saved",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleSubmitFeedback = () => {
    if (!reviewFeedback.trim()) {
      toast({
        title: "Feedback required",
        description: "Please enter your feedback before submitting.",
        variant: "destructive",
      });
      return;
    }

    feedbackMutation.mutate(reviewFeedback.trim());
  };

  const canReviewProject = () => {
    return (
      (user.role === "advisor" || user.role === "coordinator") &&
      project.status === "Under Review"
    );
  };

  const isOwnProject = () => {
    return user.role === "student" && project.students.includes(user.name);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button onClick={onBack} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {project.title}
            </h1>
            <p className="text-gray-600 mt-1">Project Details</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Badge className={getStatusColor(project.status)}>
            {getStatusDisplayName(project.status)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Project Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Project Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  Description
                </h4>
                <p className="text-gray-700 leading-relaxed">
                  {project.description}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Files and Attachments */}
          <Card>
            <CardHeader>
              <CardTitle>Files & Attachments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {project.files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <FileText className="w-8 h-8 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{file.name}</p>
                        <p className="text-sm text-gray-500">
                          {file.size} • {file.type}
                          {file.downloadable === false && (
                            <span className="ml-2 text-amber-500">
                              (metadata only)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={file.downloadable === false}
                      onClick={async () => {
                        if (file.downloadable === false) {
                          toast({
                            title: "File not available",
                            description:
                              "This file record is metadata only — the actual file was not uploaded to storage.",
                          });
                          return;
                        }
                        if (!authToken) {
                          toast({
                            title: "Authentication required",
                            description: "Please sign in to download files.",
                            variant: "destructive",
                          });
                          return;
                        }
                        try {
                          await downloadProjectFile(
                            project.id,
                            file.name,
                            authToken,
                          );
                        } catch {
                          toast({
                            title: "Download failed",
                            description:
                              "Unable to download the file. It may not have been uploaded yet.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {file.downloadable === false ? "Unavailable" : "Download"}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* External Links Saved by Students */}
          <Card>
            <CardHeader>
              <CardTitle>External Link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(project.externalLinks ?? []).length > 0 ? (
                (project.externalLinks ?? []).map((link, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                  >
                    <div className="flex items-center space-x-3">
                      <ExternalLink className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 break-all">
                          {link}
                        </p>
                        <p className="text-xs text-gray-500">
                          Saved by student
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <a href={link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open Link
                      </a>
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  No external links have been saved.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Feedback & Reviews Section */}
          <Card>
            <CardHeader>
              <CardTitle>Feedback & Reviews</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.feedback?.advisor && (
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Advisor Feedback
                  </h4>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                    {project.feedback.advisor}
                  </p>
                </div>
              )}
              {project.feedback?.coordinator && (
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Coordinator Feedback
                  </h4>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                    {project.feedback.coordinator}
                  </p>
                </div>
              )}
              {!project.feedback?.advisor && !project.feedback?.coordinator && (
                <div className="border-l-4 border-gray-300 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Feedback</h4>
                  <p className="text-gray-600">
                    No feedback has been recorded yet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit Feedback Section for advisors/coordinators */}
          {(canAdvisorSubmitFeedback || canCoordinatorSubmitFeedback) && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {user.role === "advisor"
                    ? "Submit Feedback"
                    : "Coordinator Feedback"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {user.role === "advisor"
                      ? "Your Feedback"
                      : "Coordinator Feedback"}
                  </label>
                  <Textarea
                    value={reviewFeedback}
                    onChange={(e) => setReviewFeedback(e.target.value)}
                    placeholder="Share your thoughts about the project..."
                    rows={6}
                    className="w-full resize-none"
                  />
                </div>
                <Button
                  onClick={() => handleSubmitFeedback()}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={feedbackMutation.isPending}
                >
                  {user.role === "advisor"
                    ? "Submit Feedback"
                    : "Save Feedback"}
                </Button>

                {/* Deny and Approve Buttons for Advisors */}
                {user.role === "advisor" && !isArchiveView && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button
                      onClick={() => handleReviewAction("deny")}
                      className="w-full bg-red-500 hover:bg-red-600 text-white"
                      disabled={statusMutation.isPending}
                    >
                      <XCircle className="w-5 h-5 mr-2" />
                      Deny
                    </Button>
                    <Button
                      onClick={() => handleReviewAction("approve")}
                      className="w-full bg-green-500 hover:bg-green-600 text-white"
                      disabled={statusMutation.isPending}
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Approved
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Deny and Approve Buttons - Fallback for when no feedback section shown */}
          {user.role === "advisor" &&
            !isArchiveView &&
            !canAdvisorSubmitFeedback && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => handleReviewAction("deny")}
                  className="w-full bg-red-500 hover:bg-red-600 text-white"
                  disabled={statusMutation.isPending}
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  Deny
                </Button>
                <Button
                  onClick={() => handleReviewAction("approve")}
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  disabled={statusMutation.isPending}
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Approved
                </Button>
              </div>
            )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Project Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Project Details</CardTitle>
                <div className="flex items-center gap-2">
                  {user.role === "student" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsViewRubricDialogOpen(true)}
                    >
                      View Rubric
                    </Button>
                  )}
                  {user.role === "advisor" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleOpenAssignRubricDialog}
                    >
                      Assign Rubric
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Badge variant="outline">{project.type}</Badge>
              </div>

              {assignedRubric && (
                <div className="text-sm">
                  <p className="font-medium">Assigned Rubric</p>
                  <p className="text-gray-600">{assignedRubric.name}</p>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                {/* Team Name */}
                {project.teamName && (
                  <div className="text-sm">
                    <p className="font-medium">Team Name</p>
                    <p className="text-gray-600">{project.teamName}</p>
                  </div>
                )}

                {/* Competition Information */}
                {project.type === "Competition Work" && (
                  <>
                    {project.competitionName && (
                      <div className="text-sm">
                        <p className="font-medium">Competition</p>
                        <p className="text-gray-600">
                          {project.competitionName}
                        </p>
                      </div>
                    )}
                    {project.award && (
                      <div className="text-sm">
                        <p className="font-medium">Award/Recognition</p>
                        <p className="text-gray-600">{project.award}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Dates */}
                {project.completionDate && (
                  <div className="flex items-center text-sm">
                    <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                    <div>
                      <p className="font-medium">Completed</p>
                      <p className="text-gray-600">
                        {project.completionDate === "Invalid Date"
                          ? "Not specified"
                          : new Date(
                              project.completionDate,
                            ).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}

                {project.submissionDate && (
                  <div className="flex items-center text-sm">
                    <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                    <div>
                      <p className="font-medium">Submitted</p>
                      <p className="text-gray-600">
                        {project.submissionDate === "Invalid Date" ||
                        !project.submissionDate
                          ? "Not submitted yet"
                          : new Date(
                              project.submissionDate,
                            ).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}

                <div className="text-sm">
                  <p className="font-medium">Course Code</p>
                  <p className="text-gray-600">
                    {project.courseCode || project.course}
                  </p>
                </div>

                <div className="text-sm">
                  <p className="font-medium">Semester</p>
                  <p className="text-gray-600">{project.semester}</p>
                </div>

                <div className="text-sm">
                  <p className="font-medium">Last Modified</p>
                  <p className="text-gray-600">{project.lastModified}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team & Advisors */}
          <Card>
            <CardHeader>
              <CardTitle>Team & Advisors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Students */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Students</h4>
                <div className="space-y-2">
                  {project.students.map((student, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{student}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Advisor</h4>
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">
                    {project.advisor}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grade Section */}
          <Card>
            <CardHeader>
              <CardTitle>Grade</CardTitle>
              {user.role !== "advisor" && (
                <CardDescription>
                  {project.grade
                    ? "Grade assigned by advisor"
                    : "Awaiting advisor grade"}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {user.role === "advisor" && !isArchiveView ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Grade
                    </label>
                    <Select
                      value={gradeSelection}
                      onValueChange={setGradeSelection}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {GRADE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleGradeSubmit}
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={
                      gradeMutation.isPending ||
                      !gradeSelection ||
                      gradeSelection === project.grade
                    }
                  >
                    Save Grade
                  </Button>
                  <div className="text-sm text-gray-600">
                    {project.grade || gradeSelection ? (
                      <span>
                        Current Grade:{" "}
                        <span className="font-semibold">
                          {gradeSelection || project.grade}
                        </span>
                      </span>
                    ) : (
                      "No grade assigned yet."
                    )}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-600">
                  {project.grade ? (
                    <span>
                      Current Grade:{" "}
                      <span className="font-semibold">{project.grade}</span>
                    </span>
                  ) : (
                    "No grade assigned yet."
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comments Section - Only show to project members and advisor */}
          {canAccessComments() && (
            <Card>
              <CardHeader>
                <CardTitle>Comments & Discussion</CardTitle>
                <CardDescription>
                  {project.status === "Approved"
                    ? "Project conversation history"
                    : `Communicate with ${user.role === "student" ? "your advisor" : "students"}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Conversation Summary */}
                {comments.length > 0 && (
                  <div className="flex items-center justify-between pb-2 border-b">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-gray-700">
                        {comments.length}{" "}
                        {comments.length === 1 ? "message" : "messages"} in this
                        conversation
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      Last updated{" "}
                      {formatCommentTime(
                        comments[comments.length - 1]?.created_at,
                      )}
                    </span>
                  </div>
                )}

                {/* Existing comments */}
                {comments.length > 0 && (
                  <div className="space-y-4 mb-4">
                    {comments.map((comment: any, index: number) => {
                      const isOwnComment = comment.user_email === user.email;
                      const isRecent = index >= comments.length - 3; // Last 3 comments
                      const userRole = comment.user_role || "user";
                      const roleColor =
                        userRole === "advisor"
                          ? "bg-blue-500"
                          : userRole === "student"
                            ? "bg-green-500"
                            : "bg-gray-500";

                      return (
                        <div
                          key={comment.id}
                          className={`flex space-x-3 ${isRecent ? "bg-blue-50 -mx-4 px-4 py-3 rounded-lg" : ""}`}
                        >
                          <div
                            className={`w-10 h-10 ${roleColor} rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0`}
                          >
                            <User className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`font-semibold text-sm ${isRecent ? "text-blue-900" : "text-gray-900"}`}
                                >
                                  {comment.user_name || "Unknown User"}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-xs capitalize"
                                >
                                  {userRole}
                                </Badge>
                                {isRecent && (
                                  <Badge className="text-xs bg-blue-600">
                                    Recent
                                  </Badge>
                                )}
                              </div>
                              {isOwnComment && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-gray-400 hover:text-red-600"
                                  onClick={() =>
                                    handleDeleteComment(comment.id)
                                  }
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                            <p
                              className={`text-sm leading-relaxed mb-2 break-words ${isRecent ? "text-gray-800" : "text-gray-700"}`}
                            >
                              {comment.comment}
                            </p>
                            <div className="text-xs text-gray-500">
                              {formatCommentTime(comment.created_at)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {comments.length === 0 && (
                  <div className="text-center py-6 text-gray-500 text-sm">
                    No comments yet.
                    {project.status !== "Approved" &&
                      " Start the conversation!"}
                  </div>
                )}

                {/* Add new comment - only if not approved and not in archive view */}
                {!isArchiveView && project.status !== "Approved" && (
                  <div className="border-t pt-4">
                    <div className="flex space-x-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <Textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment..."
                          rows={3}
                          className="w-full resize-none"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                              handleCommentSubmit();
                            }
                          }}
                        />
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-gray-500">
                            Press Cmd/Ctrl + Enter to send
                          </p>
                          <Button
                            onClick={() => handleCommentSubmit()}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            disabled={postCommentMutation.isPending}
                          >
                            <MessageSquare className="w-4 h-4 mr-1" />
                            Send
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog
        open={isAssignRubricDialogOpen}
        onOpenChange={setIsAssignRubricDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Rubric</DialogTitle>
            <DialogDescription>
              Choose an active rubric for this project.
            </DialogDescription>
          </DialogHeader>

          {isLoadingRubrics ? (
            <p className="text-sm text-muted-foreground">Loading rubrics...</p>
          ) : activeRubrics.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active rubrics available. Create and activate a rubric first.
            </p>
          ) : (
            <div className="space-y-4">
              <Select
                value={selectedRubricId}
                onValueChange={setSelectedRubricId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a rubric" />
                </SelectTrigger>
                <SelectContent>
                  {activeRubrics.map((rubric) => (
                    <SelectItem key={rubric.id} value={String(rubric.id)}>
                      {rubric.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex justify-end">
                <Button
                  onClick={handleAssignRubric}
                  disabled={assignRubricMutation.isPending}
                >
                  Assign
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isViewRubricDialogOpen}
        onOpenChange={setIsViewRubricDialogOpen}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Project Rubric</DialogTitle>
            <DialogDescription>
              {assignedRubric
                ? "This rubric is currently assigned to your project."
                : "No rubric has been assigned to this project yet."}
            </DialogDescription>
          </DialogHeader>

          {isLoadingRubrics ? (
            <p className="text-sm text-muted-foreground">Loading rubric...</p>
          ) : !assignedRubric ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Rubric placeholder: your advisor has not assigned a rubric yet.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {assignedRubric.name}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {assignedRubric.description || "No rubric description."}
                </p>
                <p className="text-sm text-gray-700 mt-2">
                  Max Points: {assignedRubric.max_points}
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">
                  Criteria ({assignedRubric.criteria.length})
                </h4>
                {assignedRubric.criteria.map((criterion) => (
                  <div key={criterion.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm text-gray-900">
                        {criterion.name}
                      </p>
                      <Badge variant="outline">Weight: {criterion.weight}%</Badge>
                    </div>
                    {criterion.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {criterion.description}
                      </p>
                    )}

                    {criterion.levels.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {criterion.levels
                          .slice()
                          .sort((a, b) => b.points - a.points)
                          .map((level) => (
                            <div
                              key={level.id}
                              className="flex items-start justify-between gap-3 rounded-sm bg-gray-50 px-2 py-1"
                            >
                              <div>
                                <p className="text-sm font-medium text-gray-800">
                                  {level.name}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {level.description || "No description"}
                                </p>
                              </div>
                              <span className="text-xs font-semibold text-gray-800">
                                {level.points} pts
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
