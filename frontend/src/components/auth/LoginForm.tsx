import { useState, useEffect, type FormEvent } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GraduationCap, Mail, Loader2 } from "lucide-react";
import {
  signInWithEmailAndPassword,
  AuthErrorCodes,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "firebase/auth";
import type { FirebaseError } from "firebase/app";
import { auth } from "@/lib/firebase";

interface LoginFormProps {
  onLogin: (
    user: {
      id: string;
      name: string;
      email: string;
      role: "student" | "coordinator" | "advisor";
    },
    authToken: string,
    isFirstLogin?: boolean,
  ) => void;
}

export const LoginForm = ({ onLogin }: LoginFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingEmailLink, setIsProcessingEmailLink] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // When we detect an email-link URL but don't have the email, ask for it
  const [pendingEmailLink, setPendingEmailLink] = useState(false);
  const [emailLinkEmail, setEmailLinkEmail] = useState("");

  const resolveRole = (
    value: unknown,
  ): "student" | "coordinator" | "advisor" => {
    const allowedRoles = ["student", "coordinator", "advisor"] as const;
    return allowedRoles.includes(value as never)
      ? (value as (typeof allowedRoles)[number])
      : "student";
  };

  const deriveDisplayName = (
    candidateEmail: string | null,
    displayName: string | null,
  ): string => {
    if (displayName && displayName.trim().length > 0) {
      return displayName;
    }

    if (candidateEmail && candidateEmail.includes("@")) {
      return candidateEmail.split("@")[0];
    }

    return "User";
  };

  const mapFirebaseError = (error: unknown): string => {
    if (typeof error === "object" && error !== null && "code" in error) {
      const { code } = error as FirebaseError;
      switch (code) {
        case AuthErrorCodes.INVALID_PASSWORD:
        case AuthErrorCodes.INVALID_EMAIL:
        case AuthErrorCodes.USER_DELETED:
        case AuthErrorCodes.INVALID_LOGIN_CREDENTIALS:
          return "Invalid email or password. Please try again.";
        case AuthErrorCodes.TOO_MANY_ATTEMPTS_TRY_LATER:
          return "Too many attempts. Please wait a moment before trying again.";
        default:
          return "Failed to sign in. Please check your credentials and try again.";
      }
    }

    return "Unexpected error while trying to sign in.";
  };

  // Complete email link sign-in with a known email address
  const completeEmailLinkSignIn = async (emailForSignIn: string) => {
    setIsProcessingEmailLink(true);
    setPendingEmailLink(false);
    setErrorMessage(null);

    try {
      const result = await signInWithEmailLink(
        auth,
        emailForSignIn,
        window.location.href,
      );
      localStorage.removeItem("emailForSignIn");

      const idTokenResult = await result.user.getIdTokenResult(true);
      localStorage.setItem("firebaseAuthToken", idTokenResult.token);
      localStorage.setItem("authToken", idTokenResult.token);

      // Check if this is first login (user has no password set)
      const hasPasswordProvider = result.user.providerData.some(
        (provider) => provider.providerId === "password",
      );
      const passwordSkipped = localStorage.getItem("passwordSkipped");
      const passwordSet = localStorage.getItem("passwordSet");
      const isFirstLogin =
        !hasPasswordProvider && !passwordSkipped && !passwordSet;

      if (isFirstLogin) {
        localStorage.setItem("isFirstLogin", "true");
      }

      const normalizedRole = resolveRole(idTokenResult.claims.role);

      onLogin(
        {
          id: result.user.uid,
          name: deriveDisplayName(result.user.email, result.user.displayName),
          email: result.user.email ?? emailForSignIn,
          role: normalizedRole,
        },
        idTokenResult.token,
        isFirstLogin,
      );

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      console.error("Email link sign-in error:", error);
      setErrorMessage(
        "Failed to sign in with email link. The link may have expired.",
      );
      // Clean up URL even on error
      window.history.replaceState({}, document.title, window.location.pathname);
    } finally {
      setIsProcessingEmailLink(false);
    }
  };

  // Handle email link sign-in
  useEffect(() => {
    const handleEmailLinkSignIn = async () => {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        // Try to get email from localStorage first
        const emailForSignIn = localStorage.getItem("emailForSignIn");

        if (emailForSignIn) {
          // We have the email — complete sign-in automatically
          await completeEmailLinkSignIn(emailForSignIn);
        } else {
          // No email stored — show a form to ask for it instead of window.prompt()
          setPendingEmailLink(true);
        }
      }
    };

    handleEmailLinkSignIn();
  }, [onLogin]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const idTokenResult = await credential.user.getIdTokenResult(true);

      localStorage.setItem("firebaseAuthToken", idTokenResult.token);
      localStorage.setItem("authToken", idTokenResult.token);

      const normalizedRole = resolveRole(idTokenResult.claims.role);
      const resolvedEmail = credential.user.email ?? email;

      onLogin(
        {
          id: credential.user.uid,
          name: deriveDisplayName(
            credential.user.email,
            credential.user.displayName,
          ),
          email: resolvedEmail,
          role: normalizedRole,
        },
        idTokenResult.token,
        false,
      );
    } catch (error) {
      setErrorMessage(mapFirebaseError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state when processing email link
  if (isProcessingEmailLink) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Signing you in...
                </h2>
                <p className="text-gray-600 mt-2">
                  Please wait while we verify your email link.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show email confirmation form when we have a sign-in link but no email
  if (pendingEmailLink) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Mail className="w-12 h-12 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Confirm Your Email
            </CardTitle>
            <CardDescription>
              Please enter the email address that received the sign-in link to
              complete your login.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (emailLinkEmail.trim()) {
                  completeEmailLinkSignIn(emailLinkEmail.trim());
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="emailLink">Email</Label>
                <Input
                  id="emailLink"
                  type="email"
                  placeholder="your.email@example.com"
                  value={emailLinkEmail}
                  onChange={(e) => setEmailLinkEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>
              {errorMessage && (
                <p className="text-sm text-red-600" role="alert">
                  {errorMessage}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={!emailLinkEmail.trim()}
              >
                Continue Sign In
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <GraduationCap className="w-12 h-12 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Student Project Archive
          </CardTitle>
          <CardDescription>
            Sign in to access your academic projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {errorMessage && (
              <p className="text-sm text-red-600" role="alert">
                {errorMessage}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Mail className="h-4 w-4" />
              <span>First time? Use the link sent to your email.</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
