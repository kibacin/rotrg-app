export type TextSize = "normal" | "large" | "extra-large";

export type AccessibilitySettings = {
  textSize: TextSize;
  easyReading: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
};

export const ACCESSIBILITY_STORAGE_KEY = "rotrg-accessibility-v1";

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  textSize: "normal",
  easyReading: false,
  highContrast: false,
  reduceMotion: false,
};

export function loadAccessibilitySettings(): AccessibilitySettings {
  if (typeof window === "undefined") return DEFAULT_ACCESSIBILITY_SETTINGS;

  try {
    const storedValue = window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
    if (!storedValue) return DEFAULT_ACCESSIBILITY_SETTINGS;

    const parsedValue = JSON.parse(storedValue) as Partial<AccessibilitySettings>;
    const textSize: TextSize = ["normal", "large", "extra-large"].includes(
      parsedValue.textSize || ""
    )
      ? parsedValue.textSize as TextSize
      : "normal";

    return {
      textSize,
      easyReading: parsedValue.easyReading === true,
      highContrast: parsedValue.highContrast === true,
      reduceMotion: parsedValue.reduceMotion === true,
    };
  } catch {
    return DEFAULT_ACCESSIBILITY_SETTINGS;
  }
}

export function applyAccessibilitySettings(settings: AccessibilitySettings) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.dataset.textSize = settings.textSize;
  root.dataset.easyReading = String(settings.easyReading);
  root.dataset.highContrast = String(settings.highContrast);
  root.dataset.reduceMotion = String(settings.reduceMotion);
}

export function saveAccessibilitySettings(settings: AccessibilitySettings) {
  applyAccessibilitySettings(settings);
  window.localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(settings));
}
