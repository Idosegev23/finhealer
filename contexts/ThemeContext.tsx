"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // בדיקה אם יש העדפה שמורה
    const savedTheme = localStorage.getItem("finhealer-theme") as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      // ברירת מחדל: כהה
      setTheme("dark");
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      // עדכון ה-HTML element
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(theme);
      // שמירה ב-localStorage
      localStorage.setItem("finhealer-theme", theme);
    }
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // מונע flash של תוכן לפני טעינת הנושא
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Fallback for SSR/pre-rendering - return default dark theme
    return {
      theme: "dark" as Theme,
      toggleTheme: () => {},
    };
  }
  return context;
}

