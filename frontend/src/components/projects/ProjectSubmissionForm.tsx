import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Upload, Plus, X, User, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  submitProject,
  updateProject,
  uploadProjectFiles,
  type CreateProjectPayload,
  type UpdateProjectPayload,
  type ProjectDto,
  type ProjectTeamMemberInput,
  type ProjectStatus,
  ApiError,
} from "@/services/projectApi";

interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "coordinator" | "advisor";
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "student" | "lecturer";
  isPrimary: boolean;
}

interface ProjectUpdateData {
  title?: string;
  type?: string;
  description?: string;
  course?: string;
  keywords?: string[];
  competitionName?: string;
  award?: string;
  teamName?: string;
  teamMembers?: TeamMember[];
  externalLinks?: string[];
}

interface ProjectSubmissionFormProps {
  user: User;
  authToken: string | null;
  onBack: () => void;
  editingProjectId?: string | null;
  projects?: ProjectDto[];
  onProjectUpdate?: (
    projectId: string,
    updatedData: ProjectUpdateData,
    newStatus: ProjectStatus
  ) => void;
  onProjectCreated?: (project: ProjectDto) => void;
}

const createInitialFormState = () => ({
  title: "",
  type: "",
  course: "",
  courseCode: "",
  teamName: "",
  description: "",
  keywords: [] as string[],
  groupMembers: [] as string[],
  advisors: [] as string[],
  files: [] as { name: string; size?: string; type?: string }[],
  externalLinks: [] as string[],
  completionDate: "",
  competitionName: "",
  award: "",
  publicationVenue: "",
  doi: "",
  beneficiaryOrganization: "",
});

type FormState = ReturnType<typeof createInitialFormState>;

// Mock project data for editing (in a real app, this would be fetched from API)
const mockProjects: ProjectDto[] = [
  {
    id: 3,
    title: "Blockchain Voting System",
    type: "Competition Work",
    status: "Draft",
    submissionDate: null,
    lastModified: "2024-06-01T00:00:00.000Z",
    description:
      "Secure and transparent voting system using blockchain technology...",
    students: ["John Student", "Mike Wilson"],
    studentDetails: [
      { id: 1, name: "John Student", email: "john@student.edu" },
      { id: 2, name: "Mike Wilson", email: "mike@student.edu" },
    ],
    advisor: "Dr. Sarah Lecturer",
    advisorEmail: "sarah.lecturer@university.edu",
    teamName: "Crypto Innovators",
    keywords: ["Blockchain", "Security", "Voting", "Cryptography"],
    externalLinks: ["https://github.com/project"],
    files: [],
    teamMembers: [
      {
        id: "1",
        name: "John Student",
        email: "john@student.edu",
        role: "student",
        isPrimary: true,
      },
      {
        id: "2",
        name: "Mike Wilson",
        email: "mike@student.edu",
        role: "student",
        isPrimary: false,
      },
      {
        id: "3",
        name: "Dr. Sarah Lecturer",
        email: "sarah.lecturer@university.edu",
        role: "lecturer",
        isPrimary: false,
      },
    ],
    semester: "Fall",
    year: "2024",
    competitionName: "National Blockchain Competition",
    award: "Second Place",
    courseCode: "CS401",
    completionDate: null,
    impact: "High",
  },
];

export const ProjectSubmissionForm = ({
  user,
  authToken,
  onBack,
  editingProjectId,
  projects: passedProjects,
  onProjectUpdate,
  onProjectCreated,
}: ProjectSubmissionFormProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const buildSubmitterMember = useCallback(
    (): TeamMember => ({
      id: nanoid(),
      name: user.name,
      email: user.email,
      role: "student",
      isPrimary: true,
    }),
    [user.email, user.name]
  );

  const [formData, setFormData] = useState<FormState>(createInitialFormState);

  const [newKeyword, setNewKeyword] = useState("");
  const [newLink, setNewLink] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => [
    buildSubmitterMember(),
  ]);
  const [newTeamMember, setNewTeamMember] = useState({
    name: "",
    email: "",
    role: "student" as "student" | "lecturer",
  });

  useEffect(() => {
    setTeamMembers((prev) => {
      const exists = prev.some(
        (member) => member.email.toLowerCase() === user.email.toLowerCase()
      );

      if (exists) {
        return prev;
      }

      const ensurePrimary = prev.every((member) => !member.isPrimary);

      return [
        {
          ...buildSubmitterMember(),
          isPrimary: ensurePrimary,
        },
        ...prev,
      ];
    });
  }, [buildSubmitterMember, user.email]);

  // Load project data when editing
  useEffect(() => {
    if (editingProjectId) {
      const projectsToUse = passedProjects || mockProjects;
      const projectToEdit = projectsToUse.find(
        (p) => p.id.toString() === editingProjectId
      );
      if (projectToEdit) {
        setFormData((prev) => ({
          ...prev,
          title: projectToEdit.title,
          type: projectToEdit.type,
          description: projectToEdit.description,
          keywords: projectToEdit.keywords || [],
          courseCode: projectToEdit.courseCode || "",
          course: projectToEdit.semester || "",
          competitionName: projectToEdit.competitionName || "",
          award: projectToEdit.award || "",
          teamName: projectToEdit.teamName || "",
          externalLinks: projectToEdit.externalLinks || [],
          completionDate: projectToEdit.completionDate || "",
          files: projectToEdit.files || [],
        }));

        // Load team members if available
        if (projectToEdit.teamMembers) {
          setTeamMembers(
            projectToEdit.teamMembers
              .map((member, index) => {
                const resolvedEmail =
                  typeof member.email === "string" ? member.email : "";

                if (!resolvedEmail) {
                  return null;
                }

                const resolvedRole: "student" | "lecturer" =
                  member.role === "lecturer" ? "lecturer" : "student";
                const resolvedName =
                  typeof member.name === "string" &&
                  member.name.trim().length > 0
                    ? member.name
                    : resolvedEmail;

                return {
                  id:
                    typeof member.id === "string"
                      ? member.id
                      : `${resolvedEmail}-${index}`,
                  name: resolvedName,
                  email: resolvedEmail,
                  role: resolvedRole,
                  isPrimary: Boolean(member.isPrimary),
                } satisfies TeamMember;
              })
              .filter((member): member is TeamMember => Boolean(member))
          );
        }
      }
    }
  }, [editingProjectId, passedProjects]);

  const projectTypes = [
    "Capstone",
    "Competition Work",
    "Academic Publication",
    "Social Service",
    "Other",
  ];

  const projectMutation = useMutation<ProjectDto, Error, CreateProjectPayload>({
    mutationFn: async (payload) => {
      if (!authToken) {
        throw new Error("Missing authentication token.");
      }

      const project = await submitProject(payload, authToken);

      // Upload actual files to storage after project is created
      if (pendingFiles.length > 0) {
        try {
          await uploadProjectFiles(project.id, pendingFiles, authToken);
        } catch (err) {
          console.error("File upload failed:", err);
        }
      }

      return project;
    },
    onSuccess: (project, variables) => {
      toast({
        title:
          variables.status === "Draft" ? "Draft saved" : "Project submitted",
        description:
          variables.status === "Draft"
            ? "Your project draft is saved. You can complete it later from My Projects."
            : "Your project has been submitted and is now under review.",
      });

      onProjectCreated?.(project);
      void queryClient.invalidateQueries({ queryKey: ["projects", authToken] });
      setFormData(createInitialFormState());
      setTeamMembers([buildSubmitterMember()]);
      setPendingFiles([]);
      setNewKeyword("");
      setNewLink("");
      setNewTeamMember({ name: "", email: "", role: "student" });
      onBack();
    },
    onError: (error) => {
      const message =
        error instanceof ApiError ? error.message : "Failed to submit project.";
      toast({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation<
    ProjectDto,
    Error,
    { projectId: number; payload: UpdateProjectPayload }
  >({
    mutationFn: async ({ projectId, payload }) => {
      if (!authToken) throw new Error("Missing authentication token.");
      const project = await updateProject(projectId, payload, authToken);

      // Upload actual files to storage after project is updated
      if (pendingFiles.length > 0) {
        try {
          await uploadProjectFiles(project.id, pendingFiles, authToken);
        } catch (err) {
          console.error("File upload failed:", err);
        }
      }

      return project;
    },
    onSuccess: (project, variables) => {
      toast({
        title:
          variables.payload.status === "Draft"
            ? "Draft updated"
            : "Project updated",
        description:
          variables.payload.status === "Draft"
            ? "Your project draft has been updated."
            : "Your project has been updated and submitted for review.",
      });

      onProjectUpdate?.(
        String(variables.projectId),
        {
          title: project.title,
          type: project.type,
          description: project.description,
          course: project.courseCode ?? undefined,
          keywords: project.keywords,
          competitionName: project.competitionName ?? undefined,
          award: project.award ?? undefined,
          teamName: project.teamName,
          teamMembers:
            (project.teamMembers as unknown as TeamMember[]) ?? undefined,
          externalLinks: project.externalLinks,
        },
        project.status
      );

      void queryClient.invalidateQueries({ queryKey: ["projects", authToken] });
      onBack();
    },
    onError: (error) => {
      const message =
        error instanceof ApiError ? error.message : "Failed to update project.";
      toast({
        title: "Update failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const addKeyword = () => {
    if (newKeyword.trim() && !formData.keywords.includes(newKeyword.trim())) {
      setFormData((prev) => ({
        ...prev,
        keywords: [...prev.keywords, newKeyword.trim()],
      }));
      setNewKeyword("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setFormData((prev) => ({
      ...prev,
      keywords: prev.keywords.filter((k) => k !== keyword),
    }));
  };

  const addExternalLink = () => {
    if (newLink.trim()) {
      setFormData((prev) => ({
        ...prev,
        externalLinks: [...prev.externalLinks, newLink.trim()],
      }));
      setNewLink("");
    }
  };

  const removeExternalLink = (link: string) => {
    setFormData((prev) => ({
      ...prev,
      externalLinks: prev.externalLinks.filter((l) => l !== link),
    }));
  };

  const handleFileUpload = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const files = Array.from(selectedFiles);
    const validFiles = files.filter((file) => {
      const maxSize = 50 * 1024 * 1024; // 50MB
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/zip",
      ];

      return file.size <= maxSize && allowedTypes.includes(file.type);
    });

    if (validFiles.length !== files.length) {
      toast({
        title: "Some files were rejected",
        description: "Only PDF, DOC, PPT, ZIP files up to 50MB are allowed",
        variant: "destructive",
      });
    }

    // Convert files to the format expected by the form
    const fileObjects = validFiles.map((file) => ({
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      type: file.type.split("/")[1].toUpperCase(),
    }));

    // Keep the raw File objects for actual upload later
    setPendingFiles((prev) => [...prev, ...validFiles]);

    setFormData((prev) => ({
      ...prev,
      files: [...prev.files, ...fileObjects],
    }));
  };

  const addTeamMember = () => {
    if (!newTeamMember.name.trim() || !newTeamMember.email.trim()) {
      toast({
        title: "Error",
        description: "Please fill in team member name and email",
        variant: "destructive",
      });
      return;
    }

    // Check if email already exists
    const normalizedEmail = newTeamMember.email.trim().toLowerCase();

    if (
      teamMembers.some(
        (member) => member.email.toLowerCase() === normalizedEmail
      )
    ) {
      toast({
        title: "Error",
        description: "Team member with this email already exists",
        variant: "destructive",
      });
      return;
    }

    const newMember: TeamMember = {
      id: nanoid(),
      name: newTeamMember.name.trim(),
      email: newTeamMember.email.trim(),
      role: newTeamMember.role,
      isPrimary: false,
    };

    setTeamMembers((prev) => [...prev, newMember]);
    setNewTeamMember({ name: "", email: "", role: "student" });
  };

  const removeTeamMember = (id: string) => {
    setTeamMembers((prev) => prev.filter((member) => member.id !== id));
  };

  const togglePrimaryStudent = (id: string) => {
    const primaryStudents = teamMembers.filter(
      (member) => member.isPrimary && member.role === "student"
    );
    const targetMember = teamMembers.find((member) => member.id === id);

    if (targetMember?.role !== "student") {
      toast({
        title: "Error",
        description: "Only students can be designated as primary",
        variant: "destructive",
      });
      return;
    }

    if (primaryStudents.length >= 1 && !targetMember?.isPrimary) {
      toast({
        title: "Error",
        description:
          "Only one student can be designated as primary per project",
        variant: "destructive",
      });
      return;
    }

    setTeamMembers((prev) =>
      prev.map((member) =>
        member.id === id ? { ...member, isPrimary: !member.isPrimary } : member
      )
    );
  };

  const handleSubmit = (e: React.FormEvent, isDraft = false) => {
    e.preventDefault();

    if (
      !formData.title.trim() ||
      !formData.type ||
      !formData.description.trim()
    ) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const membersWithSubmitter = (() => {
      const existing = [...teamMembers];
      const submitterEmail = user.email.toLowerCase();
      const hasSubmitter = existing.some(
        (member) => member.email.toLowerCase() === submitterEmail
      );

      if (!hasSubmitter) {
        const submitterMember = buildSubmitterMember();
        const hasPrimaryStudent = existing.some(
          (member) => member.role === "student" && member.isPrimary
        );
        submitterMember.isPrimary = !hasPrimaryStudent;
        existing.unshift(submitterMember);
      }

      return existing;
    })();

    const normalizedMembers = (() => {
      const map = new Map<string, TeamMember>();

      membersWithSubmitter.forEach((member) => {
        const emailKey = member.email.trim().toLowerCase();

        if (!emailKey || map.has(emailKey)) {
          return;
        }

        map.set(emailKey, {
          ...member,
          email: member.email.trim(),
          name: member.name.trim() || member.email.trim(),
        });
      });

      return Array.from(map.values());
    })();

    if (!isDraft) {
      const primaryStudent = normalizedMembers.find(
        (member) => member.role === "student" && member.isPrimary
      );
      if (!primaryStudent) {
        toast({
          title: "Error",
          description:
            "Please designate one student as the primary student for this project",
          variant: "destructive",
        });
        return;
      }
    }

    const pendingLink = newLink.trim();
    const candidateLinks = [...formData.externalLinks];

    if (pendingLink && !candidateLinks.includes(pendingLink)) {
      candidateLinks.push(pendingLink);
    }

    const normalizedLinks = candidateLinks
      .map((link) => link.trim())
      .filter(
        (link, index, array) => link.length > 0 && array.indexOf(link) === index
      );

    const finalStatus: ProjectStatus = isDraft ? "Draft" : "Under Review";

    if (editingProjectId) {
      const updatePayload: UpdateProjectPayload = {
        title: formData.title.trim(),
        type: formData.type,
        description: formData.description.trim(),
        keywords: formData.keywords,
        teamName: formData.teamName,
        status: finalStatus,
        semester: formData.course || undefined,
        competitionName: formData.competitionName || undefined,
        award: formData.award || undefined,
        externalLinks: normalizedLinks,
        teamMembers: normalizedMembers.map<ProjectTeamMemberInput>(
          (member) => ({
            id: member.id,
            name: member.name,
            email: member.email,
            role: member.role,
            isPrimary: member.isPrimary,
          })
        ),
        courseCode: formData.courseCode || undefined,
        completionDate: formData.completionDate || undefined,
        files: formData.files,
      };

      if (authToken) {
        updateMutation.mutate({
          projectId: Number(editingProjectId),
          payload: updatePayload,
        });
      } else if (onProjectUpdate) {
        const updateData: ProjectUpdateData = {
          title: updatePayload.title,
          type: updatePayload.type,
          description: updatePayload.description,
          course: updatePayload.semester,
          keywords: updatePayload.keywords,
          competitionName: updatePayload.competitionName,
          award: updatePayload.award,
          teamName: updatePayload.teamName,
          teamMembers: normalizedMembers,
          externalLinks: normalizedLinks,
        };
        onProjectUpdate(editingProjectId, updateData, finalStatus);
        setTimeout(() => onBack(), 100);
      }
      return;
    }

    if (!authToken) {
      toast({
        title: "Authentication required",
        description:
          "Your session has expired. Please sign in again and retry your submission.",
        variant: "destructive",
      });
      return;
    }

    const payload: CreateProjectPayload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      type: formData.type,
      keywords: formData.keywords,
      teamName: formData.teamName.trim() ? formData.teamName.trim() : undefined,
      status: finalStatus,
      semester: formData.course || undefined,
      competitionName: formData.competitionName.trim()
        ? formData.competitionName.trim()
        : undefined,
      award: formData.award.trim() ? formData.award.trim() : undefined,
      externalLinks: normalizedLinks,
      teamMembers: normalizedMembers.map<ProjectTeamMemberInput>((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        isPrimary: member.isPrimary,
      })),
      courseCode: formData.courseCode.trim()
        ? formData.courseCode.trim()
        : undefined,
      completionDate: formData.completionDate || undefined,
      files: formData.files,
    };

    projectMutation.mutate(payload);
  };

  const renderDynamicFields = () => {
    switch (formData.type) {
      case "Competition Work":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="competitionName">Competition Name</Label>
              <Input
                id="competitionName"
                value={formData.competitionName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    competitionName: e.target.value,
                  }))
                }
                placeholder="Enter competition name"
              />
            </div>
            <div>
              <Label htmlFor="award">Award/Recognition</Label>
              <Input
                id="award"
                value={formData.award}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, award: e.target.value }))
                }
                placeholder="e.g., 1st Place, Honorable Mention"
              />
            </div>
          </div>
        );
      case "Academic Publication":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="publicationVenue">Publication Venue</Label>
              <Input
                id="publicationVenue"
                value={formData.publicationVenue}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    publicationVenue: e.target.value,
                  }))
                }
                placeholder="Journal or Conference name"
              />
            </div>
            <div>
              <Label htmlFor="doi">DOI/URL</Label>
              <Input
                id="doi"
                value={formData.doi}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, doi: e.target.value }))
                }
                placeholder="https://doi.org/..."
              />
            </div>
          </div>
        );
      case "Social Service":
        return (
          <div>
            <Label htmlFor="beneficiaryOrganization">
              Beneficiary Organization/Community
            </Label>
            <Input
              id="beneficiaryOrganization"
              value={formData.beneficiaryOrganization}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  beneficiaryOrganization: e.target.value,
                }))
              }
              placeholder="Organization or community served"
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Button onClick={onBack} variant="outline" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            {editingProjectId ? "Edit Project" : "Submit New Project"}
          </h2>
          {editingProjectId && formData.title && (
            <p className="text-lg text-gray-600 mt-1">
              Editing: {formData.title}
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="title">Project Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Enter project title"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="courseCode">Course Code</Label>
                <Input
                  id="courseCode"
                  value={formData.courseCode || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      courseCode: e.target.value,
                    }))
                  }
                  placeholder="Enter course code (e.g., 1305394)"
                />
              </div>

              <div>
                <Label htmlFor="type">Project Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project type" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="course">Semester</Label>
                <Select
                  value={formData.course}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, course: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select semester" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Semester 1">Semester 1</SelectItem>
                    <SelectItem value="Semester 2">Semester 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  value={formData.teamName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      teamName: e.target.value,
                    }))
                  }
                  placeholder="Enter your team name"
                />
              </div>

              <div>
                <Label htmlFor="completionDate">Completion Date</Label>
                <Input
                  id="completionDate"
                  type="date"
                  value={formData.completionDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      completionDate: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Project Description */}
            <div>
              <Label htmlFor="description">Abstract/Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Provide a detailed description of your project..."
                rows={6}
                required
              />
            </div>

            {/* Keywords */}
            <div>
              <Label>Keywords/Tags</Label>
              <div className="flex space-x-2 mb-2">
                <Input
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Add keyword"
                  onKeyPress={(e) =>
                    e.key === "Enter" && (e.preventDefault(), addKeyword())
                  }
                />
                <Button type="button" onClick={addKeyword} size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.keywords.map((keyword, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="flex items-center space-x-1"
                  >
                    <span>{keyword}</span>
                    <button
                      type="button"
                      onClick={() => removeKeyword(keyword)}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Dynamic Fields */}
            {formData.type && (
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Additional Information
                </h3>
                {renderDynamicFields()}
              </div>
            )}

            {/* Team Member Assignment */}
            <div>
              <Label>Team Members</Label>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <Input
                    value={newTeamMember.name}
                    onChange={(e) =>
                      setNewTeamMember((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTeamMember();
                      }
                    }}
                    placeholder="Member name"
                  />
                  <Input
                    value={newTeamMember.email}
                    onChange={(e) =>
                      setNewTeamMember((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTeamMember();
                      }
                    }}
                    placeholder="Member email"
                    type="email"
                  />
                  <Select
                    value={newTeamMember.role}
                    onValueChange={(value: "student" | "lecturer") =>
                      setNewTeamMember((prev) => ({ ...prev, role: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="lecturer">Advisor</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={addTeamMember} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Member
                  </Button>
                </div>

                {teamMembers.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Click the checkbox to designate the primary student
                      (required)
                    </p>
                    {teamMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between bg-muted/50 p-3 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          {member.role === "student" && (
                            <Checkbox
                              checked={member.isPrimary}
                              onCheckedChange={() =>
                                togglePrimaryStudent(member.id)
                              }
                              className="data-[state=checked]:bg-primary"
                            />
                          )}
                          <div className="flex items-center space-x-2">
                            {member.isPrimary ? (
                              <UserCheck className="w-4 h-4 text-primary" />
                            ) : (
                              <User className="w-4 h-4 text-muted-foreground" />
                            )}
                            <div>
                              <p className="font-medium">{member.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {member.email}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={
                              member.role === "student"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {member.role}
                          </Badge>
                          {member.isPrimary && (
                            <Badge
                              variant="outline"
                              className="text-primary border-primary"
                            >
                              Primary Student
                            </Badge>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTeamMember(member.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* External Links */}
            <div>
              <Label>External Links</Label>
              <div className="flex space-x-2 mb-2">
                <Input
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  placeholder="https://github.com/project"
                  onKeyPress={(e) =>
                    e.key === "Enter" && (e.preventDefault(), addExternalLink())
                  }
                />
                <Button type="button" onClick={addExternalLink} size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-1">
                {formData.externalLinks.map((link, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-50 p-2 rounded"
                  >
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      {link}
                    </a>
                    <button
                      type="button"
                      onClick={() => removeExternalLink(link)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* File Upload */}
            <div>
              <Label>Files & Attachments</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">
                  Drag and drop files here, or click to browse
                </p>
                <p className="text-sm text-gray-500">
                  Supports PDF, DOC, PPT, ZIP files up to 50MB each
                </p>
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={() =>
                    document.getElementById("file-upload")?.click()
                  }
                >
                  Choose Files
                </Button>
              </div>

              {/* Display uploaded files */}
              {formData.files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    Uploaded Files:
                  </p>
                  {formData.files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-gray-50 p-2 rounded"
                    >
                      <span className="text-sm">
                        {file.name} ({file.size})
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            files: prev.files.filter((_, i) => i !== index),
                          }));
                          setPendingFiles((prev) =>
                            prev.filter((_, i) => i !== index)
                          );
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-4">
              {editingProjectId ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    disabled={projectMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => handleSubmit(e, true)}
                    disabled={projectMutation.isPending}
                  >
                    {projectMutation.isPending ? "Saving..." : "Save Draft"}
                  </Button>
                  <Button
                    type="button"
                    onClick={(e) => handleSubmit(e, false)}
                    disabled={projectMutation.isPending}
                  >
                    {projectMutation.isPending
                      ? "Submitting..."
                      : "Submit for Review"}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => handleSubmit(e, true)}
                    disabled={projectMutation.isPending}
                  >
                    {projectMutation.isPending ? "Saving..." : "Save Draft"}
                  </Button>
                  <Button type="submit" disabled={projectMutation.isPending}>
                    {projectMutation.isPending
                      ? "Submitting..."
                      : "Submit for Review"}
                  </Button>
                </>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
