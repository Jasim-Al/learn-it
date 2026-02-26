"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type AuthContextType = {
  user: any | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  // Define public routes that don't require authentication
  const publicRoutes = ["/login"];

  useEffect(() => {
    let mounted = true;

    async function getUser() {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (mounted) {
        if (error) {
           console.error("Auth error:", error);
           setUser(null);
        } else {
           setUser(session?.user ?? null);
        }
        setLoading(false);
      }
    }

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) {
           setUser(session?.user ?? null);
           setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  useEffect(() => {
    // Check if we need to redirect
    if (!loading) {
      const isPublicRoute = publicRoutes.includes(pathname);
      
      if (!user && !isPublicRoute) {
        router.push("/login");
      } else if (user && isPublicRoute) {
        // If user is logged in and tries to access login page, redirect to home
        router.push("/");
      }
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
        {loading ? (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 dark:border-zinc-50"></div>
            </div>
        ) : (
            children
        )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};
