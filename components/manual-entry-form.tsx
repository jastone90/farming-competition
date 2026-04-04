"use client";

import { useState } from "react";
import { ScoreBreakdown } from "./score-breakdown";
import { ACTIVITY_TYPE_LABELS } from "@/lib/constants";

const activityTypes = Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

interface ManualEntryFormProps {
  onClose: () => void;
  onSaved: () => void;
}

export function ManualEntryForm({ onClose, onSaved }: ManualEntryFormProps) {
  const [type, setType] = useState("run");
  const [title, setTitle] = useState("");
  const [distance, setDistance] = useState("");
  const [elevation, setElevation] = useState("");
  const [poundsLifted, setPoundsLifted] = useState("");
  const [isIndoor, setIsIndoor] = useState(false);
  const [withChild, setWithChild] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [preview, setPreview] = useState<{
    rawPoints: number;
    modifiedPoints: number;
    pointBreakdown: Record<string, { label: string; points: number }>;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handlePreview() {
    setError("");
    const res = await fetch("/api/scoring/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        isIndoor,
        withChild,
        distanceMiles: distance ? parseFloat(distance) : null,
        elevationGainFeet: elevation ? parseFloat(elevation) : null,
        poundsLifted: poundsLifted ? parseFloat(poundsLifted) : null,
      }),
    });
    if (res.ok) {
      setPreview(await res.json());
    }
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    const res = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        title: title || activityTypes.find((t) => t.value === type)?.label.split(" ")[0] || "Activity",
        isIndoor,
        withChild,
        distanceMiles: distance ? parseFloat(distance) : null,
        elevationGainFeet: elevation ? parseFloat(elevation) : null,
        poundsLifted: poundsLifted ? parseFloat(poundsLifted) : null,
        activityDate: date,
      }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Add Manual Activity</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">
              Activity Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              {activityTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Morning Run"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Distance (mi)
              </label>
              <input
                type="number"
                step="0.1"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Elevation (ft)
              </label>
              <input
                type="number"
                value={elevation}
                onChange={(e) => setElevation(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          {type === "weight_training" && (
            <div>
              <label className="text-sm font-medium mb-1 block">
                Pounds Lifted
              </label>
              <input
                type="number"
                value={poundsLifted}
                onChange={(e) => setPoundsLifted(e.target.value)}
                placeholder="Total lbs (1000 lbs = 1 haybail)"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="indoor"
              checked={isIndoor}
              onChange={(e) => setIsIndoor(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="indoor" className="text-sm">
              Indoor Activity
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="withChild"
              checked={withChild}
              onChange={(e) => setWithChild(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="withChild" className="text-sm">
              With Child (2.5× points)
            </label>
          </div>

          {preview && (
            <div className="rounded-lg bg-stone-50 dark:bg-stone-900 p-3">
              <p className="text-xs font-medium mb-2 text-muted-foreground">
                Score Preview
              </p>
              <ScoreBreakdown
                breakdown={preview.pointBreakdown}
                modifiedPoints={preview.modifiedPoints}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handlePreview}
              className="flex-1 rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              Preview Score
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Activity"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
