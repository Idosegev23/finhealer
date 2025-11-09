"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Search,
  Bell,
  Settings,
  User,
  LogOut,
  Menu,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PhiHeaderProps {
  toggleMobileMenu: () => void;
}

export function PhiHeader({ toggleMobileMenu }: PhiHeaderProps) {
  const { theme } = useTheme();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const isDark = theme === "dark";

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("name")
          .eq("id", user.id)
          .single();
        const profileData = profile as any;
        setUserName(
          profileData?.name || user.email?.split("@")[0] || "משתמש"
        );
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <header className="z-40 py-4 bg-phi-dark border-b border-phi-slate/30 shadow-lg">
      <div className="flex items-center justify-between h-full px-6 mx-auto">
        {/* Mobile hamburger */}
        <button
          className="p-2 rounded-md md:hidden focus:outline-none hover:bg-phi-slate/30 transition-colors"
          onClick={toggleMobileMenu}
          aria-label="Menu"
        >
          <Menu className="w-6 h-6 text-white" />
        </button>

        {/* Search Input */}
        <div className="flex justify-center flex-1 mr-4 ml-4">
          <div className="relative flex w-full max-w-xl items-stretch">
            <input
              type="search"
              placeholder="חיפוש..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input px-4 py-2 placeholder-gray-400 text-white bg-phi-slate/50 border border-phi-slate/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-phi-gold focus:border-transparent w-full pr-10 transition-all"
            />
            <span className="absolute right-0 top-0 h-full flex items-center pr-3 pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </span>
          </div>
        </div>

        {/* Right side controls */}
        <ul className="flex items-center flex-shrink-0 space-x-2 space-x-reverse">
          {/* Theme Toggle */}
          <li>
            <div className="p-2 rounded-full bg-phi-slate/30 hover:bg-phi-slate/50 transition-colors">
              <ThemeToggle />
            </div>
          </li>

          {/* Notifications menu */}
          <li className="relative">
            <button
              className="relative p-2 bg-phi-gold/90 hover:bg-phi-coral/90 rounded-full focus:outline-none transition-colors shadow-md"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              aria-label="Notifications"
              aria-haspopup="true"
            >
              <Bell className="w-5 h-5 text-white" />
              {/* Notification badge */}
              <span
                aria-hidden="true"
                className="absolute top-0 right-0 inline-block w-3 h-3 transform translate-x-1 -translate-y-1 bg-red-600 border-2 border-phi-dark rounded-full"
              ></span>
            </button>

            {notificationsOpen && (
              <div
                className="absolute left-0 w-56 mt-2 space-y-2 text-white bg-phi-slate border border-phi-gold rounded-lg shadow-2xl z-50"
                onClick={() => setNotificationsOpen(false)}
              >
                <div className="p-3 border-b border-phi-gold/30">
                  <h3 className="text-sm font-bold">התראות</h3>
                </div>
                <Link
                  href="/dashboard/expenses/pending"
                  className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold transition-colors duration-150 rounded-md hover:bg-phi-gold/20"
                >
                  <span>הוצאות ממתינות</span>
                  <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                    3
                  </span>
                </Link>
                <Link
                  href="/dashboard/goals"
                  className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold transition-colors duration-150 rounded-md hover:bg-phi-gold/20"
                >
                  <span>עדכון יעדים</span>
                </Link>
              </div>
            )}
          </li>

          {/* Profile menu */}
          <li className="relative">
            <button
              className="flex items-center gap-2 p-2 bg-phi-gold/90 hover:bg-phi-coral/90 rounded-full focus:outline-none transition-colors shadow-md"
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              aria-label="Account"
              aria-haspopup="true"
            >
              <Settings className="w-5 h-5 text-white" />
            </button>

            {profileMenuOpen && (
              <div
                className="absolute left-0 w-56 mt-2 space-y-2 text-white bg-phi-slate border border-phi-gold rounded-lg shadow-2xl z-50"
              >
                <div className="p-3 border-b border-phi-gold/30">
                  <p className="text-sm font-bold">{userName}</p>
                  <p className="text-xs text-phi-mint">משתמש פעיל</p>
                </div>
                <Link
                  href="/settings"
                  onClick={() => setProfileMenuOpen(false)}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold transition-colors duration-150 rounded-md hover:bg-phi-gold/20"
                >
                  <User className="w-5 h-5" />
                  <span>הגדרות ופרופיל</span>
                </Link>
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold text-red-400 hover:text-red-300 transition-colors duration-150 rounded-md hover:bg-red-900/20"
                >
                  <LogOut className="w-5 h-5" />
                  <span>התנתק</span>
                </button>
              </div>
            )}
          </li>
        </ul>
      </div>
    </header>
  );
}

