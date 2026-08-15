import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, ClipboardList, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fetchRubrics, type RubricDto } from "@/services/rubricApi";

/* ── Local types ─────────────────────────────────────────────────────── */

interface RubricLevel {
  id: string;
  name: string;
  description: string;
  points: number;
}

interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  ploIds: string[];
  weight: number;
  levels: RubricLevel[];
}

interface LocalRubric {
  id: string;
  name: string;
  description: string;
  projectTypes: string[];
  maxPoints: number;
  isActive: boolean;
  criteria: RubricCriterion[];
}

interface PLO {
  id: string;
  code: string;
  description: string;
  category: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "coordinator" | "advisor";
}

interface RubricViewerProps {
  user: User;
  authToken: string | null;
}

/* ── PLO reference data ──────────────────────────────────────────────── */

const samplePLOs: PLO[] = [
  { id: "plo1", code: "PLO1", description: "Apply knowledge of computing and mathematics appropriate to the discipline", category: "Knowledge" },
  { id: "plo2", code: "PLO2", description: "Analyze a problem, and identify and define computing requirements", category: "Problem Analysis" },
  { id: "plo3", code: "PLO3", description: "Design, implement, and evaluate computer-based systems", category: "Design/Development" },
  { id: "plo4", code: "PLO4", description: "Function effectively on teams to accomplish a common goal", category: "Teamwork" },
  { id: "plo5", code: "PLO5", description: "Communicate effectively with a range of audiences", category: "Communication" },
  { id: "plo6", code: "PLO6", description: "Analyze local and global impact of computing on individuals and society", category: "Ethics" },
];

/* ── Convert API DTO → local shape ───────────────────────────────────── */

const toLocalRubric = (dto: RubricDto): LocalRubric => ({
  id: dto.id.toString(),
  name: dto.name,
  description: dto.description ?? "",
  projectTypes: dto.project_types,
  maxPoints: dto.max_points,
  isActive: dto.is_active,
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
});

/* ── Component ───────────────────────────────────────────────────────── */

export const RubricViewer = ({ user, authToken }: RubricViewerProps) => {
  const [rubrics, setRubrics] = useState<LocalRubric[]>([]);
  const [selectedRubric, setSelectedRubric] = useState<LocalRubric | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const loadRubrics = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const dtos = await fetchRubrics(authToken);
      // Only show active rubrics to students/advisors
      const active = dtos.filter((d) => d.is_active).map(toLocalRubric);
      setRubrics(active);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load rubrics";
      if (!msg.includes("setup_required") && !msg.includes("migration")) {
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }, [authToken, toast]);

  useEffect(() => {
    loadRubrics();
  }, [loadRubrics]);

  const toggleCriterion = (criterionId: string) => {
    setExpandedCriteria((prev) => {
      const next = new Set(prev);
      if (next.has(criterionId)) next.delete(criterionId);
      else next.add(criterionId);
      return next;
    });
  };

  const getPLOLabel = (ploId: string) => {
    const plo = samplePLOs.find((p) => p.id === ploId);
    return plo?.code ?? ploId;
  };

  /* ── Loading state ─────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading rubrics…</span>
      </div>
    );
  }

  /* ── Empty state ───────────────────────────────────────────────────── */

  if (rubrics.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Evaluation Rubrics</h1>
          <p className="text-gray-600 mt-1">
            View the rubrics used to evaluate projects.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No Rubrics Available</h3>
            <p className="text-gray-500 text-center max-w-md">
              The coordinator has not published any rubrics yet. Check back later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Detail view ───────────────────────────────────────────────────── */

  if (selectedRubric) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedRubric(null)}>
            ← Back to rubrics
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">{selectedRubric.name}</h1>
          {selectedRubric.description && (
            <p className="text-gray-600 mt-1">{selectedRubric.description}</p>
          )}
          <div className="flex gap-2 mt-3">
            {selectedRubric.projectTypes.map((t) => (
              <Badge key={t} variant="secondary">{t}</Badge>
            ))}
            <Badge variant="outline">{selectedRubric.maxPoints} pts</Badge>
          </div>
        </div>

        {/* Criteria list */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Criteria ({selectedRubric.criteria.length})
          </h2>

          {selectedRubric.criteria.map((criterion) => {
            const isExpanded = expandedCriteria.has(criterion.id);
            return (
              <Card key={criterion.id} className="overflow-hidden">
                <button
                  onClick={() => toggleCriterion(criterion.id)}
                  className="w-full text-left"
                >
                  <CardHeader className="pb-3 cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          {criterion.name}
                          <Badge variant="outline" className="text-xs">
                            Weight: {criterion.weight}%
                          </Badge>
                        </CardTitle>
                        {criterion.description && (
                          <p className="text-sm text-gray-500 mt-1">{criterion.description}</p>
                        )}
                        {criterion.ploIds.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {criterion.ploIds.map((ploId) => (
                              <Badge key={ploId} variant="secondary" className="text-xs">
                                {getPLOLabel(ploId)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400 ml-4" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400 ml-4" />
                      )}
                    </div>
                  </CardHeader>
                </button>

                {isExpanded && criterion.levels.length > 0 && (
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">Level</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-[80px] text-right">Points</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...criterion.levels]
                          .sort((a, b) => b.points - a.points)
                          .map((level) => (
                            <TableRow key={level.id}>
                              <TableCell className="font-medium">{level.name}</TableCell>
                              <TableCell className="text-gray-600">
                                {level.description || "—"}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {level.points}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Rubric list ───────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Evaluation Rubrics</h1>
        <p className="text-gray-600 mt-1">
          View the rubrics used to evaluate your projects.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rubrics.map((rubric) => (
          <Card
            key={rubric.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => {
              setSelectedRubric(rubric);
              setExpandedCriteria(new Set());
            }}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                {rubric.name}
              </CardTitle>
              {rubric.description && (
                <p className="text-sm text-gray-500 line-clamp-2">{rubric.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1 mb-3">
                {rubric.projectTypes.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{rubric.criteria.length} criteria</span>
                <span className="font-medium">{rubric.maxPoints} pts</span>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-3">
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
