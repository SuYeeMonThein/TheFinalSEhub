import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Save, FileText, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Project {
  id: string;
  title: string;
  type: string;
  studentName: string;
  teamName: string;
  submissionDate: string;
}

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

interface Rubric {
  id: string;
  name: string;
  description: string;
  criteria: RubricCriterion[];
  maxPoints: number;
}

interface Evaluation {
  id: string;
  projectId: string;
  rubricId: string;
  evaluatorId: string;
  scores: { [criterionId: string]: { levelId: string; points: number; comments: string } };
  totalScore: number;
  finalComments: string;
  submittedAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "coordinator" | "advisor";
}

interface ProjectEvaluationProps {
  user: User;
  project: Project;
  rubric: Rubric;
  onBack: () => void;
}

const samplePLOs = [
  { id: "plo1", code: "PLO1", description: "Apply knowledge of computing and mathematics appropriate to the discipline" },
  { id: "plo2", code: "PLO2", description: "Analyze a problem, and identify and define computing requirements" },
  { id: "plo3", code: "PLO3", description: "Design, implement, and evaluate computer-based systems" },
  { id: "plo4", code: "PLO4", description: "Function effectively on teams to accomplish a common goal" },
  { id: "plo5", code: "PLO5", description: "Communicate effectively with a range of audiences" },
  { id: "plo6", code: "PLO6", description: "Analyze local and global impact of computing on individuals and society" }
];

export const ProjectEvaluation = ({ user, project, rubric, onBack }: ProjectEvaluationProps) => {
  const { toast } = useToast();
  const [scores, setScores] = useState<{ [criterionId: string]: { levelId: string; points: number; comments: string } }>({});
  const [finalComments, setFinalComments] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const updateScore = (criterionId: string, levelId: string, points: number) => {
    setScores(prev => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        levelId,
        points,
        comments: prev[criterionId]?.comments || ""
      }
    }));
  };

  const updateComments = (criterionId: string, comments: string) => {
    setScores(prev => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        comments,
        levelId: prev[criterionId]?.levelId || "",
        points: prev[criterionId]?.points || 0
      }
    }));
  };

  const calculateTotalScore = () => {
    let weightedSum = 0;
    let totalWeight = 0;

    rubric.criteria.forEach(criterion => {
      const score = scores[criterion.id];
      if (score && score.points > 0) {
        weightedSum += (score.points / 4) * criterion.weight; // Assuming 4 is max points per level
        totalWeight += criterion.weight;
      }
    });

    return totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
  };

  const getCompletionPercentage = () => {
    const completedCriteria = Object.keys(scores).filter(id => scores[id]?.levelId).length;
    return (completedCriteria / rubric.criteria.length) * 100;
  };

  const canSubmit = () => {
    return rubric.criteria.every(criterion => scores[criterion.id]?.levelId);
  };

  const submitEvaluation = () => {
    if (!canSubmit()) {
      toast({
        title: "Error",
        description: "Please evaluate all criteria before submitting",
        variant: "destructive",
      });
      return;
    }

    const evaluation: Evaluation = {
      id: Date.now().toString(),
      projectId: project.id,
      rubricId: rubric.id,
      evaluatorId: user.id,
      scores,
      totalScore: calculateTotalScore(),
      finalComments,
      submittedAt: new Date().toISOString()
    };

    setIsSubmitted(true);
    toast({
      title: "Success",
      description: "Project evaluation submitted successfully",
    });

    // In a real app, this would save to backend
    console.log("Evaluation submitted:", evaluation);
  };

  const getPLODisplayName = (ploId: string) => {
    const plo = samplePLOs.find(p => p.id === ploId);
    return plo ? plo.code : ploId;
  };

  if (user.role !== "advisor") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Only advisors can evaluate projects.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button onClick={onBack} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Project Evaluation</h2>
            <p className="text-muted-foreground">Using: {rubric.name}</p>
          </div>
        </div>
        {isSubmitted && (
          <Badge variant="default" className="flex items-center space-x-1">
            <CheckCircle className="w-4 h-4" />
            <span>Submitted</span>
          </Badge>
        )}
      </div>

      {/* Project Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Project Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Project Title</Label>
              <p className="text-sm">{project.title}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Project Type</Label>
              <p className="text-sm">{project.type}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Student Name</Label>
              <p className="text-sm">{project.studentName}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Team Name</Label>
              <p className="text-sm">{project.teamName || "Individual Project"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Evaluation Progress</span>
              <span>{Math.round(getCompletionPercentage())}% Complete</span>
            </div>
            <Progress value={getCompletionPercentage()} />
            {canSubmit() && (
              <div className="flex justify-between text-sm mt-4">
                <span className="font-medium">Total Score</span>
                <span className="font-bold text-primary">{Math.round(calculateTotalScore())}/100</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Evaluation Criteria */}
      <div className="space-y-6">
        {rubric.criteria.map((criterion, index) => (
          <Card key={criterion.id}>
            <CardHeader>
              <CardTitle className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">{index + 1}. {criterion.name}</span>
                    <Badge variant="outline">{criterion.weight}%</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground font-normal">{criterion.description}</p>
                  {criterion.ploIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs text-muted-foreground mr-2">Linked PLOs:</span>
                      {criterion.ploIds.map(ploId => (
                        <Badge key={ploId} variant="secondary" className="text-xs">
                          {getPLODisplayName(ploId)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Performance Level</Label>
                  <RadioGroup
                    value={scores[criterion.id]?.levelId || ""}
                    onValueChange={(value) => {
                      const level = criterion.levels.find(l => l.id === value);
                      if (level) {
                        updateScore(criterion.id, value, level.points);
                      }
                    }}
                    disabled={isSubmitted}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {criterion.levels
                        .sort((a, b) => b.points - a.points) // Sort by points descending
                        .map((level) => (
                        <div key={level.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value={level.id} id={`${criterion.id}-${level.id}`} />
                            <Label 
                              htmlFor={`${criterion.id}-${level.id}`} 
                              className="font-medium cursor-pointer"
                            >
                              {level.name}
                            </Label>
                            <Badge variant="outline" className="ml-auto">
                              {level.points} pts
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{level.description}</p>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor={`comments-${criterion.id}`} className="text-sm font-medium">
                    Comments & Feedback
                  </Label>
                  <Textarea
                    id={`comments-${criterion.id}`}
                    value={scores[criterion.id]?.comments || ""}
                    onChange={(e) => updateComments(criterion.id, e.target.value)}
                    placeholder="Provide specific feedback for this criterion..."
                    rows={3}
                    disabled={isSubmitted}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Final Comments */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Evaluation Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="finalComments" className="text-sm font-medium">
                Final Comments & Recommendations
              </Label>
              <Textarea
                id="finalComments"
                value={finalComments}
                onChange={(e) => setFinalComments(e.target.value)}
                placeholder="Provide overall feedback, strengths, areas for improvement, and recommendations..."
                rows={5}
                disabled={isSubmitted}
              />
            </div>

            {canSubmit() && !isSubmitted && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Ready to Submit</p>
                    <p className="text-sm text-muted-foreground">
                      Final Score: {Math.round(calculateTotalScore())}/100
                    </p>
                  </div>
                  <Button onClick={submitEvaluation}>
                    <Save className="w-4 h-4 mr-2" />
                    Submit Evaluation
                  </Button>
                </div>
              </div>
            )}

            {isSubmitted && (
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">Evaluation Submitted Successfully</p>
                    <p className="text-sm text-green-700">
                      Final Score: {Math.round(calculateTotalScore())}/100 | 
                      Submitted on {new Date().toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};