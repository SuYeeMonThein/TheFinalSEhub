import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Trash2, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Comment {
  id: number;
  comment: string;
  created_at: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

interface ProjectCommentsProps {
  projectId: string;
  authToken: string;
  currentUserEmail: string;
  currentUserRole: string;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

export const ProjectComments = ({
  projectId,
  authToken,
  currentUserEmail,
  currentUserRole,
}: ProjectCommentsProps) => {
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/comments/${projectId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch comments");
      }

      const data = await response.json();
      setComments(data.comments || []);
    } catch (error) {
      console.error("Error fetching comments:", error);
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId && authToken) {
      void fetchComments();
    }
  }, [projectId, authToken]);

  const handleSendComment = async () => {
    if (!newComment.trim()) {
      toast({
        title: "Error",
        description: "Please enter a comment",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/comments/${projectId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ comment: newComment }),
      });

      if (!response.ok) {
        throw new Error("Failed to send comment");
      }

      const data = await response.json();
      setComments([...comments, data.comment]);
      setNewComment("");
      toast({
        title: "Success",
        description: "Comment posted successfully",
      });
    } catch (error) {
      console.error("Error sending comment:", error);
      toast({
        title: "Error",
        description: "Failed to post comment",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/comments/${commentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete comment");
      }

      setComments(comments.filter((c) => c.id !== commentId));
      toast({
        title: "Success",
        description: "Comment deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "advisor":
        return "bg-blue-100 text-blue-800";
      case "student":
        return "bg-green-100 text-green-800";
      case "coordinator":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Comments & Discussion
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comments List */}
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No comments yet. Start the conversation!
            </div>
          ) : (
            comments.map((comment) => {
              const isOwnComment =
                comment.user.email.toLowerCase() ===
                currentUserEmail.toLowerCase();
              const canDelete =
                isOwnComment || currentUserRole === "coordinator";

              return (
                <div
                  key={comment.id}
                  className="flex gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-sm">
                      {getInitials(comment.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">
                            {comment.user.name}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(
                              comment.user.role,
                            )}`}
                          >
                            {comment.user.role}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(comment.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">
                          {comment.comment}
                        </p>
                      </div>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* New Comment Input */}
        <div className="space-y-2 pt-4 border-t">
          <Textarea
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                void handleSendComment();
              }
            }}
            rows={3}
            className="resize-none"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">
              Press Cmd/Ctrl + Enter to send
            </span>
            <Button
              onClick={handleSendComment}
              disabled={!newComment.trim() || isSending}
              size="sm"
            >
              <Send className="w-4 h-4 mr-2" />
              {isSending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
