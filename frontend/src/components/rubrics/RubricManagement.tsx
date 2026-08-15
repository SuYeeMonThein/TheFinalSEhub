import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Eye, Save, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchRubrics,
  createRubric,
  updateRubric,
  deleteRubric as deleteRubricApi,
  toggleRubricStatus as toggleRubricStatusApi,
  type RubricDto,
  type CriterionInput,
} from "@/services/rubricApi";

interface PLO {
  id: string;
  code: string;
  description: string;
  category: string;
}

interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  ploIds: string[];
  weight: number;
  levels: RubricLevel[];
}

interface RubricLevel {
  id: string;
  name: string;
  description: string;
  points: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "coordinator" | "advisor";
}

interface RubricManagementProps {
  user: User;
  authToken: string | null;
}

// Sample PLOs data
const samplePLOs: PLO[] = [
  {
    id: "plo1",
    code: "PLO1",
    description:
      "Apply knowledge of computing and mathematics appropriate to the discipline",
    category: "Knowledge",
  },
  {
    id: "plo2",
    code: "PLO2",
    description:
      "Analyze a problem, and identify and define computing requirements",
    category: "Problem Analysis",
  },
  {
    id: "plo3",
    code: "PLO3",
    description: "Design, implement, and evaluate computer-based systems",
    category: "Design/Development",
  },
  {
    id: "plo4",
    code: "PLO4",
    description: "Function effectively on teams to accomplish a common goal",
    category: "Teamwork",
  },
  {
    id: "plo5",
    code: "PLO5",
    description: "Communicate effectively with a range of audiences",
    category: "Communication",
  },
  {
    id: "plo6",
    code: "PLO6",
    description:
      "Analyze local and global impact of computing on individuals and society",
    category: "Ethics",
  },
];

// Helper to convert API RubricDto to local view format
const toLocalRubric = (dto: RubricDto) => ({
  id: dto.id.toString(),
  name: dto.name,
  description: dto.description ?? "",
  projectTypes: dto.project_types,
  criteria: dto.criteria.map((c) => ({
    id: c.id.toString(),
    name: c.name,
    description: c.description ?? "",
    ploIds: c.plo_ids,
    weight: c.weight,
    levels: c.levels.map((l) => ({
      id: l.id.toString(),
      name: l.name,
      description: l.description ?? "",
      points: l.points,
    })),
  })),
  maxPoints: dto.max_points,
  createdBy: dto.created_by,
  createdAt: dto.created_at?.split("T")[0] ?? "",
  isActive: dto.is_active,
});

type LocalRubric = ReturnType<typeof toLocalRubric>;

export const RubricManagement = ({
  user,
  authToken,
}: RubricManagementProps) => {
  const { toast } = useToast();
  const [rubrics, setRubrics] = useState<LocalRubric[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [selectedRubric, setSelectedRubric] = useState<LocalRubric | null>(
    null,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("list");
  const [isSaving, setIsSaving] = useState(false);

  const [newRubric, setNewRubric] = useState<
    Partial<{
      name: string;
      description: string;
      projectTypes: string[];
      criteria: RubricCriterion[];
    }>
  >({
    name: "",
    description: "",
    projectTypes: [],
    criteria: [],
  });

  // ── Load rubrics from API ────────────────────────────────────────────
  const loadRubrics = useCallback(async () => {
    if (!authToken) return;
    setIsLoading(true);
    setSetupRequired(false);
    try {
      const data = await fetchRubrics(authToken);
      setRubrics(data.map(toLocalRubric));
    } catch (err: any) {
      const msg: string = err.message ?? "";
      if (
        msg.toLowerCase().includes("migration") ||
        msg.toLowerCase().includes("setup") ||
        msg.toLowerCase().includes("not been created")
      ) {
        setSetupRequired(true);
      } else {
        toast({
          title: "Error",
          description: msg || "Failed to load rubrics",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [authToken, toast]);

  useEffect(() => {
    void loadRubrics();
  }, [loadRubrics]);

  const [newCriterion, setNewCriterion] = useState<Partial<RubricCriterion>>({
    name: "",
    description: "",
    ploIds: [],
    weight: 10,
    levels: [
      { id: "l1", name: "Excellent", description: "", points: 4 },
      { id: "l2", name: "Good", description: "", points: 3 },
      { id: "l3", name: "Satisfactory", description: "", points: 2 },
      { id: "l4", name: "Needs Improvement", description: "", points: 1 },
    ],
  });

  const projectTypes = [
    "Capstone",
    "Competition Work",
    "Academic Publication",
    "Social Service",
    "Other",
  ];

  const addCriterion = () => {
    if (!newCriterion.name || !newCriterion.description) {
      toast({
        title: "Error",
        description: "Please fill in criterion name and description",
        variant: "destructive",
      });
      return;
    }

    const criterion: RubricCriterion = {
      id: Date.now().toString(),
      name: newCriterion.name,
      description: newCriterion.description,
      ploIds: newCriterion.ploIds || [],
      weight: newCriterion.weight || 10,
      levels: newCriterion.levels || [],
    };

    setNewRubric((prev) => ({
      ...prev,
      criteria: [...(prev.criteria || []), criterion],
    }));

    setNewCriterion({
      name: "",
      description: "",
      ploIds: [],
      weight: 10,
      levels: [
        { id: "l1", name: "Excellent", description: "", points: 4 },
        { id: "l2", name: "Good", description: "", points: 3 },
        { id: "l3", name: "Satisfactory", description: "", points: 2 },
        { id: "l4", name: "Needs Improvement", description: "", points: 1 },
      ],
    });
  };

  const saveRubric = async () => {
    if (
      !newRubric.name ||
      !newRubric.description ||
      !newRubric.criteria?.length
    ) {
      toast({
        title: "Error",
        description:
          "Please fill in all required fields and add at least one criterion",
        variant: "destructive",
      });
      return;
    }

    const totalWeight = newRubric.criteria.reduce(
      (sum, criterion) => sum + criterion.weight,
      0,
    );
    if (totalWeight !== 100) {
      toast({
        title: "Error",
        description: "Criterion weights must total 100%",
        variant: "destructive",
      });
      return;
    }

    if (!authToken) {
      toast({
        title: "Error",
        description: "Not authenticated",
        variant: "destructive",
      });
      return;
    }

    const criteriaPayload: CriterionInput[] = newRubric.criteria.map((c) => ({
      name: c.name,
      description: c.description,
      ploIds: c.ploIds,
      weight: c.weight,
      levels: c.levels.map((l) => ({
        name: l.name,
        description: l.description,
        points: l.points,
      })),
    }));

    setIsSaving(true);
    try {
      if (isEditing && selectedRubric) {
        await updateRubric(
          parseInt(selectedRubric.id),
          {
            name: newRubric.name,
            description: newRubric.description,
            projectTypes: newRubric.projectTypes ?? [],
            criteria: criteriaPayload,
            maxPoints: 100,
          },
          authToken,
        );
      } else {
        await createRubric(
          {
            name: newRubric.name,
            description: newRubric.description,
            projectTypes: newRubric.projectTypes ?? [],
            criteria: criteriaPayload,
            maxPoints: 100,
          },
          authToken,
        );
      }

      await loadRubrics();
      setIsCreating(false);
      setIsEditing(false);
      setSelectedRubric(null);
      setNewRubric({
        name: "",
        description: "",
        projectTypes: [],
        criteria: [],
      });
      setActiveTab("list");

      toast({
        title: "Success",
        description: isEditing
          ? "Rubric updated successfully"
          : "Rubric created successfully",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message ?? "Failed to save rubric",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const editRubric = (rubric: LocalRubric) => {
    setSelectedRubric(rubric);
    setNewRubric({
      name: rubric.name,
      description: rubric.description,
      projectTypes: rubric.projectTypes,
      criteria: rubric.criteria,
    });
    setIsEditing(true);
    setIsCreating(true);
    setActiveTab("create");
  };

  const handleDeleteRubric = async (id: string) => {
    if (!authToken) return;
    try {
      await deleteRubricApi(parseInt(id), authToken);
      await loadRubrics();
      toast({ title: "Success", description: "Rubric deleted successfully" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message ?? "Failed to delete rubric",
        variant: "destructive",
      });
    }
  };

  const handleToggleRubricStatus = async (id: string) => {
    if (!authToken) return;
    try {
      await toggleRubricStatusApi(parseInt(id), authToken);
      await loadRubrics();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message ?? "Failed to toggle status",
        variant: "destructive",
      });
    }
  };

  const getPLODisplayName = (ploId: string) => {
    const plo = samplePLOs.find((p) => p.id === ploId);
    return plo ? `${plo.code}: ${plo.description}` : ploId;
  };

  if (user.role !== "advisor") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">
          Only advisors can manage rubrics.
        </p>
      </div>
    );
  }

  if (setupRequired) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Rubric Management</h2>
          <p className="text-muted-foreground">
            Create and manage evaluation rubrics linked to PLOs
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-amber-600">
              ⚠ Database Setup Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              The rubric tables have not been created in the database yet. To
              enable rubric management, run the database migration:
            </p>
            <div className="rounded-md bg-muted p-4 font-mono text-sm space-y-2">
              <p className="font-semibold">
                Option 1 — Run the migration script:
              </p>
              <code className="block">
                cd backend/api && node scripts/runMigration.js
              </code>
              <p className="font-semibold mt-4">
                Option 2 — Paste SQL in the Supabase Dashboard:
              </p>
              <p>
                Open the{" "}
                <a
                  href="https://supabase.com/dashboard/project/pkgqgvwkvcuigxbwrmkj/sql/new"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline"
                >
                  SQL Editor
                </a>{" "}
                and run the contents of:
              </p>
              <code className="block">
                backend/database/migrations/20260223_add_rubrics.sql
              </code>
            </div>
            <Button onClick={() => void loadRubrics()} variant="outline">
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Rubric Management</h2>
          <p className="text-muted-foreground">
            Create and manage evaluation rubrics linked to PLOs
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">Rubrics</TabsTrigger>
          <TabsTrigger value="create">
            {isEditing ? "Edit Rubric" : "Create Rubric"}
          </TabsTrigger>
          <TabsTrigger value="plos">PLOs Reference</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setIsCreating(true);
                setIsEditing(false);
                setNewRubric({
                  name: "",
                  description: "",
                  projectTypes: [],
                  criteria: [],
                });
                setActiveTab("create");
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Rubric
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Evaluation Rubrics</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  <span>Loading rubrics…</span>
                </div>
              ) : rubrics.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  No rubrics yet. Create your first rubric to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Project Types</TableHead>
                      <TableHead>Criteria Count</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rubrics.map((rubric) => (
                      <TableRow key={rubric.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{rubric.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {rubric.description}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {rubric.projectTypes.map((type) => (
                              <Badge
                                key={type}
                                variant="secondary"
                                className="text-xs"
                              >
                                {type}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{rubric.criteria.length}</TableCell>
                        <TableCell>
                          <Badge
                            variant={rubric.isActive ? "default" : "secondary"}
                          >
                            {rubric.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>{rubric.createdAt}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl">
                                <DialogHeader>
                                  <DialogTitle>{rubric.name}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                                  <p className="text-sm text-muted-foreground">
                                    {rubric.description}
                                  </p>
                                  {rubric.criteria.map((criterion) => (
                                    <Card key={criterion.id}>
                                      <CardHeader>
                                        <CardTitle className="text-lg flex justify-between">
                                          {criterion.name}
                                          <Badge variant="outline">
                                            {criterion.weight}%
                                          </Badge>
                                        </CardTitle>
                                        <p className="text-sm text-muted-foreground">
                                          {criterion.description}
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                          {criterion.ploIds.map((ploId) => {
                                            const plo = samplePLOs.find(
                                              (p) => p.id === ploId,
                                            );
                                            return (
                                              <Badge
                                                key={ploId}
                                                variant="secondary"
                                                className="text-xs"
                                              >
                                                {plo?.code}
                                              </Badge>
                                            );
                                          })}
                                        </div>
                                      </CardHeader>
                                      <CardContent>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                          {criterion.levels.map((level) => (
                                            <div
                                              key={level.id}
                                              className="border rounded p-3"
                                            >
                                              <div className="flex justify-between items-center mb-2">
                                                <h4 className="font-medium">
                                                  {level.name}
                                                </h4>
                                                <Badge variant="outline">
                                                  {level.points} pts
                                                </Badge>
                                              </div>
                                              <p className="text-sm text-muted-foreground">
                                                {level.description}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => editRubric(rubric)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleToggleRubricStatus(rubric.id)
                              }
                            >
                              {rubric.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteRubric(rubric.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {isEditing ? "Edit Rubric" : "Create New Rubric"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rubricName">Rubric Name *</Label>
                  <Input
                    id="rubricName"
                    value={newRubric.name || ""}
                    onChange={(e) =>
                      setNewRubric((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Enter rubric name"
                  />
                </div>
                <div>
                  <Label>Project Types</Label>
                  <Select
                    onValueChange={(value) => {
                      if (!newRubric.projectTypes?.includes(value)) {
                        setNewRubric((prev) => ({
                          ...prev,
                          projectTypes: [...(prev.projectTypes || []), value],
                        }));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Add project types" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {newRubric.projectTypes?.map((type) => (
                      <Badge
                        key={type}
                        variant="secondary"
                        className="flex items-center space-x-1"
                      >
                        <span>{type}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setNewRubric((prev) => ({
                              ...prev,
                              projectTypes: prev.projectTypes?.filter(
                                (t) => t !== type,
                              ),
                            }))
                          }
                          className="ml-1 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="rubricDescription">Description *</Label>
                <Textarea
                  id="rubricDescription"
                  value={newRubric.description || ""}
                  onChange={(e) =>
                    setNewRubric((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Describe the purpose and scope of this rubric"
                  rows={3}
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Add Evaluation Criterion
                </h3>
                <div className="space-y-4 border rounded p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="criterionName">Criterion Name</Label>
                      <Input
                        id="criterionName"
                        value={newCriterion.name || ""}
                        onChange={(e) =>
                          setNewCriterion((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="e.g., Technical Implementation"
                      />
                    </div>
                    <div>
                      <Label htmlFor="criterionWeight">Weight (%)</Label>
                      <Input
                        id="criterionWeight"
                        type="number"
                        value={newCriterion.weight ?? ""}
                        onChange={(e) => {
                          const rawValue = e.target.value;
                          setNewCriterion((prev) => ({
                            ...prev,
                            weight:
                              rawValue === "" ? undefined : Number(rawValue),
                          }));
                        }}
                        inputMode="numeric"
                        max="100"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="criterionDescription">Description</Label>
                    <Textarea
                      id="criterionDescription"
                      value={newCriterion.description || ""}
                      onChange={(e) =>
                        setNewCriterion((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Describe what this criterion evaluates"
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>Linked PLOs</Label>
                    <Select
                      onValueChange={(value) => {
                        if (!newCriterion.ploIds?.includes(value)) {
                          setNewCriterion((prev) => ({
                            ...prev,
                            ploIds: [...(prev.ploIds || []), value],
                          }));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Link to PLOs" />
                      </SelectTrigger>
                      <SelectContent>
                        {samplePLOs.map((plo) => (
                          <SelectItem key={plo.id} value={plo.id}>
                            {plo.code}: {plo.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {newCriterion.ploIds?.map((ploId) => {
                        const plo = samplePLOs.find((p) => p.id === ploId);
                        return (
                          <Badge
                            key={ploId}
                            variant="secondary"
                            className="flex items-center space-x-1"
                          >
                            <span>{plo?.code}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setNewCriterion((prev) => ({
                                  ...prev,
                                  ploIds: prev.ploIds?.filter(
                                    (id) => id !== ploId,
                                  ),
                                }))
                              }
                              className="ml-1 hover:text-red-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label>Performance Levels</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                      {newCriterion.levels?.map((level, index) => (
                        <div key={level.id} className="border rounded p-3">
                          <div className="flex justify-between items-center mb-2">
                            <Input
                              value={level.name}
                              onChange={(e) => {
                                const newLevels = [
                                  ...(newCriterion.levels || []),
                                ];
                                newLevels[index] = {
                                  ...level,
                                  name: e.target.value,
                                };
                                setNewCriterion((prev) => ({
                                  ...prev,
                                  levels: newLevels,
                                }));
                              }}
                              placeholder="Level name"
                              className="text-sm"
                            />
                            <Input
                              type="number"
                              value={level.points}
                              onChange={(e) => {
                                const newLevels = [
                                  ...(newCriterion.levels || []),
                                ];
                                newLevels[index] = {
                                  ...level,
                                  points: parseInt(e.target.value),
                                };
                                setNewCriterion((prev) => ({
                                  ...prev,
                                  levels: newLevels,
                                }));
                              }}
                              className="w-16 text-sm ml-2"
                              min="0"
                              max="4"
                            />
                          </div>
                          <Textarea
                            value={level.description}
                            onChange={(e) => {
                              const newLevels = [
                                ...(newCriterion.levels || []),
                              ];
                              newLevels[index] = {
                                ...level,
                                description: e.target.value,
                              };
                              setNewCriterion((prev) => ({
                                ...prev,
                                levels: newLevels,
                              }));
                            }}
                            placeholder="Level description"
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button onClick={addCriterion} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Criterion
                  </Button>
                </div>
              </div>

              {newRubric.criteria && newRubric.criteria.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Current Criteria (
                    {newRubric.criteria.reduce((sum, c) => sum + c.weight, 0)}%
                    total weight)
                  </h3>
                  <div className="space-y-3">
                    {newRubric.criteria.map((criterion) => (
                      <Card key={criterion.id}>
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h4 className="font-medium">
                                  {criterion.name}
                                </h4>
                                <Badge variant="outline">
                                  {criterion.weight}%
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {criterion.description}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {criterion.ploIds.map((ploId) => {
                                  const plo = samplePLOs.find(
                                    (p) => p.id === ploId,
                                  );
                                  return (
                                    <Badge
                                      key={ploId}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {plo?.code}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setNewRubric((prev) => ({
                                  ...prev,
                                  criteria: prev.criteria?.filter(
                                    (c) => c.id !== criterion.id,
                                  ),
                                }))
                              }
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                    setActiveTab("list");
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={saveRubric} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {isEditing ? "Update Rubric" : "Save Rubric"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plos">
          <Card>
            <CardHeader>
              <CardTitle>Program Learning Outcomes (PLOs)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Reference guide for linking rubric criteria to curriculum
                outcomes
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {samplePLOs.map((plo) => (
                  <Card key={plo.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start space-x-4">
                        <Badge variant="outline" className="mt-1">
                          {plo.code}
                        </Badge>
                        <div className="flex-1">
                          <p className="font-medium">{plo.description}</p>
                          <Badge variant="secondary" className="mt-2">
                            {plo.category}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
