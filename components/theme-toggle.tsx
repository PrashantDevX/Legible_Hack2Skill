"use client";

import { useEffect, useState } from "react";

/** Light/dark toggle. Choice is persisted; default follows the system. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try {
      localStorage.setItem("legible-theme", next ? "dark" : "light");
    } catch {
      // Storage blocked — the toggle still works for this session.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="rounded-lg border border-line px-2.5 py-1.5 text-sm text-muted"
    >
      {dark ? "☀" : "☾"}
    </button>
  );
}
