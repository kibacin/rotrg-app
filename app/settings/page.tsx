"use client";

import { useEffect, useState } from "react";
import { Check, Contrast, Eye, RotateCcw, Settings2, Sparkles, Type } from "lucide-react";
import { AppPage, PageHeader } from "@/components/app-shell";
import { NotificationSettings } from "@/components/notification-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DEFAULT_ACCESSIBILITY_SETTINGS,
  loadAccessibilitySettings,
  saveAccessibilitySettings,
  type AccessibilitySettings,
  type TextSize,
} from "../lib/accessibility";

function SettingToggle({
  title,
  description,
  enabled,
  icon: Icon,
  onChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  icon: typeof Eye;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      aria-pressed={enabled}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition sm:p-4 ${
        enabled
          ? "border-cyan-300/25 bg-cyan-300/[0.075]"
          : "border-white/8 bg-black/10 hover:border-white/15 hover:bg-white/[0.04]"
      }`}
    >
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
        enabled ? "bg-cyan-300/12 text-cyan-300" : "bg-white/5 text-slate-500"
      }`}>
        <Icon size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-white">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{description}</span>
      </span>
      <span className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${
        enabled ? "bg-cyan-300" : "bg-white/10"
      }`}>
        <span className={`flex size-5 items-center justify-center rounded-full bg-white text-slate-950 shadow transition ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}>
          {enabled && <Check size={12} strokeWidth={3} />}
        </span>
      </span>
    </button>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AccessibilitySettings>(
    DEFAULT_ACCESSIBILITY_SETTINGS
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSettings(loadAccessibilitySettings());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const updateSettings = (nextSettings: AccessibilitySettings) => {
    setSettings(nextSettings);
    saveAccessibilitySettings(nextSettings);
  };

  const updateTextSize = (textSize: TextSize) => {
    updateSettings({ ...settings, textSize });
  };

  return (
    <AppPage>
      <PageHeader
        eyebrow="Your device"
        title="Settings"
        description="Adjust reading support and choose which chat alerts you receive."
        icon={Settings2}
      />

      <Card className="border border-white/8 bg-white/[0.03] py-0">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-300">
              <Type size={19} />
            </div>
            <div>
              <h2 className="font-semibold text-white">Text size</h2>
              <p className="mt-0.5 text-xs text-slate-500">Increase all text across the application.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {([
              { value: "normal" as const, label: "Normal", sample: "A" },
              { value: "large" as const, label: "Large", sample: "A" },
              { value: "extra-large" as const, label: "Extra large", sample: "A" },
            ]).map((option, index) => {
              const selected = settings.textSize === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateTextSize(option.value)}
                  aria-pressed={selected}
                  className={`rounded-2xl border px-2 py-3 text-center transition ${
                    selected
                      ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200"
                      : "border-white/8 bg-black/10 text-slate-500 hover:border-white/15 hover:text-white"
                  }`}
                >
                  <span className={`block font-semibold ${index === 0 ? "text-base" : index === 1 ? "text-xl" : "text-2xl"}`}>
                    {option.sample}
                  </span>
                  <span className="mt-1 block text-[10px] font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <section>
        <div className="mb-3">
          <h2 className="font-semibold text-white">Reading support</h2>
          <p className="mt-0.5 text-xs text-slate-500">Helpful options for dyslexia and reduced vision.</p>
        </div>
        <div className="space-y-2.5">
          <SettingToggle
            title="Easy-reading layout"
            description="Uses a simpler font with wider letter and line spacing."
            enabled={settings.easyReading}
            icon={Eye}
            onChange={(easyReading) => updateSettings({ ...settings, easyReading })}
          />
          <SettingToggle
            title="High contrast"
            description="Makes muted text and interface borders easier to see."
            enabled={settings.highContrast}
            icon={Contrast}
            onChange={(highContrast) => updateSettings({ ...settings, highContrast })}
          />
          <SettingToggle
            title="Reduce animations"
            description="Removes movement and most visual transitions."
            enabled={settings.reduceMotion}
            icon={Sparkles}
            onChange={(reduceMotion) => updateSettings({ ...settings, reduceMotion })}
          />
        </div>
      </section>

      <NotificationSettings />

      <Button
        type="button"
        variant="outline"
        onClick={() => updateSettings(DEFAULT_ACCESSIBILITY_SETTINGS)}
        className="h-11 w-full rounded-xl border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.05] hover:text-white"
      >
        <RotateCcw size={16} /> Reset reading settings
      </Button>
    </AppPage>
  );
}
