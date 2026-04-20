import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { LoginForm } from "@/components/auth/LoginForm";
import { SetPasswordModal } from "@/components/auth/SetPasswordModal";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { auth } from "@/lib/firebase";
import { onIdTokenChanged } from "firebase/auth";

const Index = () => {
  const [user, setUser] = useState<{
    id: string;
    name: string;
    email: string;
    role: "student" | "coordinator" | "advisor";
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Load user from localStorage on component mount
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("authToken");
    const isFirstLogin = localStorage.getItem("isFirstLogin") === "true";

    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);

        // Show password modal if first login
        if (isFirstLogin) {
          setShowPasswordModal(true);
        }
      } catch (error) {
        console.error("Failed to parse saved user data:", error);
        localStorage.removeItem("user");
      }
    }

    if (savedToken) {
      setAuthToken(savedToken);
    }
    setIsLoading(false);
  }, []);

  // Keep Firebase ID token fresh and synced
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const fresh = await firebaseUser.getIdToken(/* forceRefresh */ true);
          setAuthToken(fresh);
          localStorage.setItem("authToken", fresh);
          localStorage.setItem("firebaseAuthToken", fresh);
          // Restore user from storage if present, but do not synthesize a new one here
          if (!user) {
            const stored = localStorage.getItem("user");
            if (stored) {
              try {
                setUser(JSON.parse(stored));
              } catch {
                // ignore
              }
            }
          }
        } catch (e) {
          console.warn("Failed to refresh Firebase ID token", e);
        }
      } else {
        // Fully clear auth and user on sign-out/change
        setAuthToken(null);
        setUser(null);
        localStorage.removeItem("authToken");
        localStorage.removeItem("firebaseAuthToken");
        localStorage.removeItem("user");
        localStorage.removeItem("currentView");
        localStorage.removeItem("selectedProject");
        localStorage.removeItem("editingProject");
      }
    });

    // Optional periodic refresh safeguard
    const refreshTimer = setInterval(
      () => {
        const u = auth.currentUser;
        if (u) {
          void u.getIdToken(true).catch(() => {});
        }
      },
      45 * 60 * 1000,
    ); // every 45 minutes

    return () => {
      unsubscribe();
      clearInterval(refreshTimer);
    };
  }, [user]);

  const handleLogin = (
    userData: {
      id: string;
      name: string;
      email: string;
      role: "student" | "coordinator" | "advisor";
    },
    token: string,
    isFirstLogin?: boolean,
  ) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    setAuthToken(token);
    localStorage.setItem("authToken", token);

    // Show password modal for first-time email link sign-ins
    if (isFirstLogin) {
      setShowPasswordModal(true);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setAuthToken(null);
    setShowPasswordModal(false);
    localStorage.removeItem("user");
    localStorage.removeItem("currentView");
    localStorage.removeItem("selectedProject");
    localStorage.removeItem("editingProject");
    localStorage.removeItem("projects");
    localStorage.removeItem("firebaseAuthToken");
    localStorage.removeItem("authToken");
    localStorage.removeItem("isFirstLogin");
    localStorage.removeItem("passwordSkipped");
    localStorage.removeItem("passwordSet");
    void signOut(auth).catch((error) => {
      console.error("Failed to sign out from Firebase", error);
    });
  };

  const handlePasswordModalClose = () => {
    setShowPasswordModal(false);
    localStorage.removeItem("isFirstLogin");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <>
      <Dashboard user={user} authToken={authToken} onLogout={handleLogout} />
      <SetPasswordModal
        open={showPasswordModal}
        onClose={handlePasswordModalClose}
        userEmail={user.email}
      />
    </>
  );
};

export default Index;
