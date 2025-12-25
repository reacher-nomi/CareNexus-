import React, { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const API_BASE = "http://localhost:5000/api";

interface CreatePatientModalProps {
  insuranceNumber: string;
  onClose: () => void;
  onPatientCreated: (patient: any) => void;
}

export default function CreatePatientModal({
  insuranceNumber,
  onClose,
  onPatientCreated,
}: CreatePatientModalProps) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    birth_date: null as Date | null,
    insurance_number: insuranceNumber,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.first_name || !formData.last_name || !formData.birth_date) {
      setError("Please fill in all required fields");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const dobString = formData.birth_date.toISOString().split("T")[0];
      const response = await fetch(`${API_BASE}/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          birth_date: dobString,
          insurance_number: formData.insurance_number,
        }),
      });

      const data = await response.json();

      if (response.ok && data.patient) {
        onPatientCreated(data.patient);
        onClose();
      } else {
        if (response.status === 401) {
          setError("Session expired. Please log in again.");
          // Optionally redirect to login
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          setError(data.error || "Failed to create patient");
        }
      }
    } catch (err) {
      setError("Error creating patient");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "8px",
          maxWidth: "500px",
          width: "90%",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>Create New Patient</h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Insurance Number:
            </label>
            <input
              type="text"
              value={formData.insurance_number}
              disabled
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                background: "#f5f5f5",
              }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              First Name: *
            </label>
            <input
              type="text"
              value={formData.first_name}
              onChange={(e) =>
                setFormData({ ...formData, first_name: e.target.value })
              }
              required
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
              }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Last Name: *
            </label>
            <input
              type="text"
              value={formData.last_name}
              onChange={(e) =>
                setFormData({ ...formData, last_name: e.target.value })
              }
              required
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
              }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Date of Birth: *
            </label>
            <DatePicker
              selected={formData.birth_date}
              onChange={(date: Date | null) =>
                setFormData({ ...formData, birth_date: date })
              }
              dateFormat="yyyy-MM-dd"
              placeholderText="Select date of birth"
              maxDate={new Date()}
              showYearDropdown
              showMonthDropdown
              dropdownMode="select"
              wrapperClassName="date-picker-wrapper"
              className="date-picker-input"
              required
            />
          </div>

          {error && (
            <div style={{ color: "red", marginBottom: "15px", fontSize: "14px" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                border: "1px solid #ccc",
                background: "white",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "8px 16px",
                background: "#3366cc",
                color: "white",
                border: "none",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Creating..." : "Create Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

