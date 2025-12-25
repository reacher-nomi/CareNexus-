import React, { useState, useEffect } from "react";

const API_BASE = "http://localhost:5000/api";

interface SheetFormProps {
  patientId: number;
  visitId: number;
  sheetType: "neurologic" | "vascular" | "cardiac" | "respiratory" | "abdomen";
  onSave: () => void;
  onBack: () => void; // NEW PROP
}

interface SheetData {
  [key: string]: string;
}

const SHEET_FIELDS: Record<string, Array<{ name: string; label: string; rows?: number }>> = {
  neurologic: [
    { name: "cranial_nerves", label: "Cranial Nerves (II-XII)", rows: 3 },
    { name: "motor_strength", label: "Motor Strength", rows: 3 },
    { name: "reflexes", label: "Reflexes", rows: 2 },
    { name: "sensation", label: "Sensation", rows: 2 },
    { name: "coordination", label: "Coordination & Gait", rows: 2 },
    { name: "mental_status", label: "Mental Status", rows: 2 },
  ],
  vascular: [
    { name: "pulses", label: "Pulses (radial, femoral, pedal)", rows: 3 },
    { name: "edema", label: "Edema", rows: 2 },
    { name: "capillary_refill", label: "Capillary Refill", rows: 2 },
    { name: "varicosities", label: "Varicosities", rows: 2 },
    { name: "bruits", label: "Bruits", rows: 2 },
  ],
  cardiac: [
    { name: "rate_rhythm", label: "Rate & Rhythm", rows: 2 },
    { name: "heart_sounds", label: "Heart Sounds (S1, S2, murmurs)", rows: 3 },
    { name: "chest_pain", label: "Chest Pain Assessment", rows: 2 },
    { name: "jvp", label: "Jugular Venous Pressure", rows: 2 },
    { name: "peripheral_perfusion", label: "Peripheral Perfusion", rows: 2 },
  ],
  respiratory: [
    { name: "respiratory_rate", label: "Respiratory Rate & Pattern", rows: 2 },
    { name: "breath_sounds", label: "Breath Sounds", rows: 3 },
    { name: "adventitious_sounds", label: "Adventitious Sounds (wheezes/crackles)", rows: 2 },
    { name: "oxygen_saturation", label: "Oxygen Saturation", rows: 2 },
    { name: "chest_expansion", label: "Chest Expansion", rows: 2 },
  ],
  abdomen: [
    { name: "inspection", label: "Inspection", rows: 2 },
    { name: "auscultation", label: "Auscultation", rows: 2 },
    { name: "palpation", label: "Palpation", rows: 3 },
    { name: "percussion", label: "Percussion", rows: 2 },
    { name: "liver", label: "Liver", rows: 2 },
    { name: "spleen", label: "Spleen", rows: 2 },
  ],
};

export default function SheetForm({ patientId, visitId, sheetType, onSave, onBack }: SheetFormProps) {
  const [data, setData] = useState<SheetData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"current" | "history">("current");
  const [history, setHistory] = useState<any[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);

  useEffect(() => {
    loadLatestSheet();
    loadHistory();
  }, [patientId, sheetType]);

  const loadLatestSheet = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/sheets/${sheetType}/${patientId}/latest?visit_id=${visitId}`,
        { credentials: "include" }
      );
      if (response.ok) {
        const result = await response.json();
        setData(result.data || {});
        setSelectedHistoryId(result.id);
      }
    } catch (err) {
      console.error("Error loading sheet:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/sheets/${sheetType}/${patientId}/history`, {
        credentials: "include",
      });
      if (response.ok) {
        const result = await response.json();
        setHistory(result.history || []);
      }
    } catch (err) {
      console.error("Error loading history:", err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/sheets/${sheetType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          patient_id: patientId,
          visit_id: visitId,
          data,
          edit_reason: selectedHistoryId ? "Updated entry" : "New entry",
        }),
      });

      if (response.ok) {
        alert("Sheet saved successfully");
        onSave();
        loadHistory();
      } else {
        alert("Failed to save sheet");
      }
    } catch (err) {
      console.error("Error saving sheet:", err);
      alert("Error saving sheet");
    } finally {
      setSaving(false);
    }
  };

  const handleNew = () => {
    setData({});
    setSelectedHistoryId(null);
  };

  const loadHistoryEntry = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE}/sheets/entry/${id}`, {
        credentials: "include",
      });
      if (response.ok) {
        const result = await response.json();
        setData(result.data || {});
        setSelectedHistoryId(id);
      }
    } catch (err) {
      console.error("Error loading history entry:", err);
    }
  };

  const fields = SHEET_FIELDS[sheetType] || [];

  if (loading) return <div style={{ padding: "20px" }}>Loading...</div>;

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ textTransform: "capitalize" }}>{sheetType} Examination</h2>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => setViewMode("current")}>Current Visit</button>
          <button onClick={() => setViewMode("history")}>History</button>
          <button onClick={onBack} style={{ background: "#666" }}>← Back to Main</button>
        </div>
      </div>

      {viewMode === "history" && (
        <div style={{ marginBottom: "20px", padding: "10px", background: "#f5f5f5", borderRadius: "4px" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>Previous Entries</h3>
          {history.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#666" }}>No history available</p>
          ) : (
            <select
              style={{ width: "100%", padding: "6px" }}
              onChange={(e) => loadHistoryEntry(Number(e.target.value))}
              value={selectedHistoryId || ""}
            >
              <option value="">Select a previous entry...</option>
              {history.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.created_at} - Visit: {entry.visit_date || "N/A"}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {fields.map((field, idx) => (
          <div key={field.name} style={{ gridColumn: idx % 2 === 0 ? "1" : "2" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              {field.label}
            </label>
            <textarea
              rows={field.rows || 2}
              value={data[field.name] || ""}
              onChange={(e) => setData({ ...data, [field.name]: e.target.value })}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "13px",
                fontFamily: "inherit",
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: "30px", display: "flex", gap: "10px" }}>
        <button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={handleNew}>New Entry</button>
        <button onClick={onBack} style={{ marginLeft: "auto", background: "#888" }}>
          Back
        </button>
      </div>
    </div>
  );
}
