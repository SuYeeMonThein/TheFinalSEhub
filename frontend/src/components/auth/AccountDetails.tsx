import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  User as UserIcon,
  Mail,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "coordinator" | "advisor";
}

interface AccountDetailsProps {
  user: User;
  authToken?: string | null;
}

const resolveBaseUrl = (): string => {
  const meta = import.meta as unknown as {
    env?: Record<string, string | undefined>;
  };

  // Prefer explicit Vite env when available.
  const explicit = meta.env?.VITE_API_BASE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  // Production-safe fallback for Render deployments.
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.endsWith("onrender.com")) {
      return "https://se-hub-pro.onrender.com";
    }
  }

  const configured = "http://localhost:5001";
  return configured.replace(/\/$/, "");
};

const API_BASE_URL = resolveBaseUrl();

export const AccountDetails = ({ user, authToken }: AccountDetailsProps) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long.";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter.";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter.";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number.";
    }
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:'\",.<>?/`~]/.test(password)) {
      return "Password must contain at least one special character.";
    }
    return null;
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    const validationError = validatePassword(newPassword);
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    if (!authToken) {
      setMessage({
        type: "error",
        text: "You must be signed in to change your password.",
      });
      return;
    }

    setIsResetting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/profile/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        const validationDetail = Array.isArray(body?.details)
          ? body.details.find((d: unknown) => {
              if (!d || typeof d !== "object") return false;
              const entry = d as { message?: unknown };
              return typeof entry.message === "string" && entry.message.length > 0;
            })
          : null;

        const validationMessage =
          validationDetail && typeof validationDetail === "object"
            ? (validationDetail as { message?: string }).message
            : null;

        setMessage({
          type: "error",
          text:
            validationMessage ||
            body?.error ||
            "Failed to update password. Please try again.",
        });
        return;
      }

      setMessage({ type: "success", text: "Password updated successfully!" });
      setNewPassword("");
      setConfirmPassword("");
      setShowForm(false);
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? `Failed to update password. ${error.message}`
            : "Failed to update password. Please try again.",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const roleLabel =
    user.role === "advisor"
      ? "Advisor"
      : user.role === "coordinator"
        ? "Coordinator"
        : "Student";

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-900">Account Details</h2>

      {/* Profile Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="w-5 h-5" />
            Profile Information
          </CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500">Name</p>
              <p className="text-base text-gray-900 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-gray-400" />
                {user.name}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500">Email</p>
              <p className="text-base text-gray-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                {user.email}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500">Role</p>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-400" />
                <Badge variant="outline">{roleLabel}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Reset Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Password
          </CardTitle>
          <CardDescription>
            Change your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          {message && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg mb-4 ${
                message.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="text-sm">{message.text}</span>
            </div>
          )}

          {!showForm ? (
            <Button onClick={() => setShowForm(true)} variant="default">
              <KeyRound className="w-4 h-4 mr-2" />
              Reset Password
            </Button>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    tabIndex={-1}
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  At least 8 characters, with uppercase, lowercase, and a
                  number, and a special character.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={isResetting}>
                  {isResetting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setNewPassword("");
                    setConfirmPassword("");
                    setMessage(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
