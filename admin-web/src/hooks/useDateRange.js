import { useState } from "react";

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function presetToRange(key) {
  const today = new Date();
  if (key === "all") return { from: "", to: "" };
  if (key === "today") return { from: ymd(today), to: ymd(today) };
  const days = key === "7d" ? 7 : 30;
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  return { from: ymd(from), to: ymd(today) };
}

export function useDateRange(defaultPreset = "30d") {
  const [preset, setPresetState] = useState(defaultPreset);
  const [range, setRange] = useState(presetToRange(defaultPreset));

  function applyPreset(key) {
    setPresetState(key);
    setRange(presetToRange(key));
  }

  function setCustom(next) {
    setPresetState("custom");
    setRange(next);
  }

  return { preset, range, applyPreset, setCustom };
}
