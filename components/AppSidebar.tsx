"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, LayoutGrid, UserCircle, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/utils/supabase/client";

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <aside className="w-[60px] md:w-[72px] h-screen bg-sidebar border-r border-sidebar-border flex flex-col items-center py-6 shrink-0 z-50 sticky top-0">
      {/* Logo */}
      <Link href="/" className="mb-8 p-2 rounded-xl bg-orange-50 text-orange-600">
        <Leaf className="w-6 h-6" />
      </Link>

      {/* Main Navigation */}
      <nav className="flex flex-col gap-4 w-full px-2">
        <Link 
          href="/" 
          className={cn(
            "p-3 rounded-xl flex items-center justify-center transition-colors text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100",
            pathname === "/" && "bg-zinc-100 text-zinc-900"
          )}
        >
          <LayoutGrid className="w-5 h-5" />
        </Link>

      </nav>

      {/* Bottom Profile/Actions */}
      <div className="mt-auto flex flex-col gap-4 w-full px-2">
        {user ? (
          <button 
            onClick={handleSignOut}
            title="Sign Out"
            className="p-3 rounded-xl flex items-center justify-center transition-colors text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
          >
            <LogOut className="w-5 h-5" />
          </button>
        ) : (
          <Link 
            href="/login" 
            title="Login"
            className="p-3 rounded-xl flex items-center justify-center transition-colors text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
          >
            <UserCircle className="w-5 h-5" />
          </Link>
        )}
      </div>
    </aside>
  );
}
