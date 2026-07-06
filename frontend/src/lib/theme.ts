const THEME_KEY = "fs_theme";

// "system" follows the OS preference (including live changes while the app
// is open); "light"/"dark" are manual overrides.
export type ThemePreference = "system" | "light" | "dark";

const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

export function themePreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

export function resolvedTheme(pref: ThemePreference = themePreference()): "light" | "dark" {
  if (pref === "system") return systemDark.matches ? "dark" : "light";
  return pref;
}

function apply(pref: ThemePreference) {
  document.documentElement.classList.toggle("dark", resolvedTheme(pref) === "dark");
}

// Auto → Hell → Dunkel → Auto …
export function cycleThemePreference(): ThemePreference {
  const order: ThemePreference[] = ["system", "light", "dark"];
  const next = order[(order.indexOf(themePreference()) + 1) % order.length];
  if (next === "system") localStorage.removeItem(THEME_KEY);
  else localStorage.setItem(THEME_KEY, next);
  apply(next);
  return next;
}

export function initTheme() {
  apply(themePreference());
  // Follow live OS changes while in "system" mode.
  systemDark.addEventListener("change", () => {
    if (themePreference() === "system") apply("system");
  });
}
