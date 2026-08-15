import { useState } from "react";
import {
  updatePassword,
  EmailAuthProvider,
  linkWithCredential,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";

interface SetPasswordModalProps {
  open: boolean;
  onClose: () => void;
  userEmail: string;
}

export function SetPasswordModal({
  open,
  onClose,
  userEmail,
}: SetPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const passwordRequirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains a number", met: /\d/.test(password) },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Contains lowercase letter", met: /[a-z]/.test(password) },
  ];

  const allRequirementsMet = passwordRequirements.every((req) => req.met);
  const passwordsMatch =
    password === confirmPassword && confirmPassword.length > 0;

  const handleSetPassword = async () => {
    if (!allRequirementsMet) {
      toast({
        title: "Error",
        description: "Please meet all password requirements",
        variant: "destructive",
      });
      return;
    }

    if (!passwordsMatch) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const user = auth.currentUser;

      if (!user) {
        throw new Error("No user signed in");
      }

      // Check if user already has password provider
      const hasPasswordProvider = user.providerData.some(
        (provider) => provider.providerId === "password",
      );

      if (hasPasswordProvider) {
        // Update existing password
        await updatePassword(user, password);
      } else {
        // Link email/password credential to existing account
        const credential = EmailAuthProvider.credential(userEmail, password);
        await linkWithCredential(user, credential);
      }

      toast({
        title: "Password Set Successfully! 🎉",
        description: "You can now login with your email and password.",
      });

      // Mark password as set
      localStorage.setItem("passwordSet", "true");
      localStorage.removeItem("isFirstLogin");
      onClose();
    } catch (error: unknown) {
      console.error("Set password error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to set password";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("passwordSkipped", "true");
    localStorage.removeItem("isFirstLogin");
    toast({
      title: "Skipped Password Setup",
      description: "You can set a password later from your profile settings.",
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-600" />
            <DialogTitle>Set Your Password</DialogTitle>
          </div>
          <DialogDescription>
            Create a password so you can sign in with email and password in the
            future. You can also continue using the email link sign-in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="setup-email">Email</Label>
            <Input
              id="setup-email"
              value={userEmail}
              disabled
              className="bg-gray-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="setup-password">New Password</Label>
            <div className="relative">
              <Input
                id="setup-password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Password Requirements */}
          <div className="space-y-2 text-sm">
            {passwordRequirements.map((req, index) => (
              <div
                key={index}
                className={`flex items-center gap-2 ${
                  req.met ? "text-green-600" : "text-gray-500"
                }`}
              >
                <CheckCircle2
                  className={`h-4 w-4 ${req.met ? "opacity-100" : "opacity-30"}`}
                />
                <span>{req.label}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="setup-confirm-password">Confirm Password</Label>
            <div className="relative">
              <Input
                id="setup-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-sm text-red-500">Passwords do not match</p>
            )}
            {passwordsMatch && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Passwords match
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={handleSkip}>
            Skip for now
          </Button>
          <Button
            onClick={handleSetPassword}
            disabled={isLoading || !allRequirementsMet || !passwordsMatch}
          >
            {isLoading ? "Setting Password..." : "Set Password"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
