import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Eye,
  Calendar,
  User,
  ExternalLink,
  Grid,
  List,
  Award,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ProjectDto } from "@/services/projectApi";

interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "coordinator" | "advisor";
}

interface ProjectArchiveProps {
  user: User;
  onViewProject: (projectId: string) => void;
  projects?: ProjectDto[];
  isLoading?: boolean;
}

export const ProjectArchive = ({
  user,
  onViewProject,
  projects,
  isLoading = false,
}: ProjectArchiveProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const availableProjects = useMemo(() => {
    const curated = (projects ?? []).filter((project) => {
      const normalizedStatus = (project.status ?? "")
        .toString()
        .trim()
        .toLowerCase();
      return normalizedStatus === "approved";
    });
    return curated;
  }, [projects, isLoading]);

  const filteredProjects = availableProjects.filter((project) => {
    const keywordList = project.keywords ?? [];
    const matchesSearch =
      project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      keywordList.some((keyword) =>
        keyword.toLowerCase().includes(searchTerm.toLowerCase()),
      ) ||
      project.students.some((student) =>
        student.toLowerCase().includes(searchTerm.toLowerCase()),
      ) ||
      project.advisor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.courseCode &&
        project.courseCode.toString().includes(searchTerm));
    const matchesType = typeFilter === "all" || project.type === typeFilter;
    const matchesYear = yearFilter === "all" || project.year === yearFilter;
    const matchesSemester =
      semesterFilter === "all" || project.semester === semesterFilter;

    return matchesSearch && matchesType && matchesYear && matchesSemester;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Project Archive</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-sm text-gray-500">
            {filteredProjects.length} project(s) available
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative md:col-span-1 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search projects, keywords, authors, course codes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Capstone">Capstone</SelectItem>
            <SelectItem value="Competition Work">Competition Work</SelectItem>
            <SelectItem value="Academic Publication">
              Academic Publication
            </SelectItem>
            <SelectItem value="Social Service">Social Service</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>

        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            <SelectItem value="2024">2024</SelectItem>
            <SelectItem value="2023">2023</SelectItem>
            <SelectItem value="2022">2022</SelectItem>
          </SelectContent>
        </Select>

        <Select value={semesterFilter} onValueChange={setSemesterFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by semester" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Semesters</SelectItem>
            <SelectItem value="Semester 1">Semester 1</SelectItem>
            <SelectItem value="Semester 2">Semester 2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Projects View */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => {
            const projectId = project.id.toString();
            const completionLabel = project.completionDate
              ? new Date(project.completionDate).toLocaleDateString()
              : "Completion date unavailable";
            const semesterLabel = project.semester ?? "";
            const yearLabel = project.year ?? "";
            const keywordList = project.keywords ?? [];

            return (
              <Card
                key={projectId}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg line-clamp-2">
                      {project.title}
                    </CardTitle>
                    <Badge variant="outline" className="shrink-0 ml-2">
                      {project.type}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-3">
                    {project.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Year */}
                  <div className="flex justify-start items-center">
                    <Badge variant="outline">
                      {[semesterLabel, yearLabel].filter(Boolean).join(" ") ||
                        "Semester not set"}
                    </Badge>
                  </div>

                  {/* Project Details */}
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      <span className="line-clamp-1">
                        {project.students.join(", ")}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>Completed: {completionLabel}</span>
                    </div>
                    {project.grade && (
                      <div className="flex items-center">
                        <Award className="w-4 h-4 mr-2" />
                        <span>Grade: {project.grade}</span>
                      </div>
                    )}
                  </div>

                  {(project.feedback?.advisor ||
                    project.feedback?.coordinator) && (
                    <div className="space-y-2">
                      {project.feedback?.advisor && (
                        <Alert className="p-3">
                          <AlertTitle className="text-xs uppercase tracking-wide text-gray-500">
                            Advisor Feedback
                          </AlertTitle>
                          <AlertDescription className="text-sm text-gray-700 whitespace-pre-line">
                            {project.feedback.advisor}
                          </AlertDescription>
                        </Alert>
                      )}
                      {project.feedback?.coordinator && (
                        <Alert className="p-3">
                          <AlertTitle className="text-xs uppercase tracking-wide text-gray-500">
                            Coordinator Feedback
                          </AlertTitle>
                          <AlertDescription className="text-sm text-gray-700 whitespace-pre-line">
                            {project.feedback.coordinator}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}

                  {/* Keywords */}
                  <div className="flex flex-wrap gap-1">
                    {keywordList.slice(0, 3).map((keyword, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="text-xs"
                      >
                        {keyword}
                      </Badge>
                    ))}
                    {keywordList.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{keywordList.length - 3} more
                      </Badge>
                    )}
                  </div>

                  {/* External Links */}
                  {project.externalLinks &&
                    project.externalLinks.length > 0 && (
                      <div className="flex items-center text-sm text-blue-600">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        <span>
                          {project.externalLinks.length} external link(s)
                        </span>
                      </div>
                    )}

                  {/* Actions */}
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => onViewProject(projectId)}
                      size="sm"
                      className="flex-1"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Advisor</TableHead>
                <TableHead>Completion Date</TableHead>
                <TableHead>Keywords</TableHead>
                <TableHead>Feedback</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => {
                const projectId = project.id.toString();
                const completionLabel = project.completionDate
                  ? new Date(project.completionDate).toLocaleDateString()
                  : "Completion date unavailable";
                const semesterLabel = project.semester ?? "";
                const yearLabel = project.year ?? "";
                const keywordList = project.keywords ?? [];

                return (
                  <TableRow key={projectId}>
                    <TableCell className="font-medium">
                      <div className="max-w-xs">
                        <div className="font-semibold">{project.title}</div>
                        <div className="text-sm text-gray-600 line-clamp-2">
                          {project.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{project.type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="line-clamp-2">
                        {project.students.join(", ")}
                      </div>
                    </TableCell>
                    <TableCell>{project.advisor}</TableCell>
                    <TableCell>
                      <div className="text-sm">{completionLabel}</div>
                      <div className="text-xs text-gray-500">
                        {[semesterLabel, yearLabel].filter(Boolean).join(" ") ||
                          ""}
                      </div>
                      {project.grade && (
                        <div className="flex items-center text-xs text-gray-600 mt-1">
                          <Award className="w-3 h-3 mr-1" />
                          <span>Grade: {project.grade}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {keywordList.slice(0, 2).map((keyword, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="text-xs"
                          >
                            {keyword}
                          </Badge>
                        ))}
                        {keywordList.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{keywordList.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-sm">
                      <div className="space-y-2 text-xs text-gray-700">
                        {project.feedback?.advisor && (
                          <div>
                            <div className="font-semibold uppercase tracking-wide text-gray-500">
                              Advisor
                            </div>
                            <div className="whitespace-pre-line">
                              {project.feedback.advisor}
                            </div>
                          </div>
                        )}
                        {project.feedback?.coordinator && (
                          <div>
                            <div className="font-semibold uppercase tracking-wide text-gray-500">
                              Coordinator
                            </div>
                            <div className="whitespace-pre-line">
                              {project.feedback.coordinator}
                            </div>
                          </div>
                        )}
                        {!project.feedback?.advisor &&
                          !project.feedback?.coordinator && (
                            <div className="text-gray-400">No feedback</div>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        onClick={() => onViewProject(projectId)}
                        size="sm"
                        variant="outline"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {filteredProjects.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg">No projects found</div>
          <p className="text-gray-500 mt-2">
            Try adjusting your search criteria or filters
          </p>
        </div>
      )}

      {filteredProjects.length === 0 && isLoading && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg">Loading archive…</div>
        </div>
      )}
    </div>
  );
};
