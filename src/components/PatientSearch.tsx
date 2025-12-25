import React, { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const API_BASE = "http://localhost:5000/api";

interface PatientSearchProps {
  onPatientFound: (patient: any, visits: any[]) => void;
  onPatientNotFound: (insuranceNumber: string) => void;
}

export default function PatientSearch({ onPatientFound, onPatientNotFound }: PatientSearchProps) {
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!insuranceNumber) {
      setError("Insurance number is required");
      return;
    }

    if (!birthDate) {
      setError("Date of birth is required for verification");
      return;
    }

    setSearching(true);
    setError("");

    try {
      // Step 2: Verify with insurance number + DOB
      const dobString = birthDate.toISOString().split("T")[0];
      const response = await fetch(
        `${API_BASE}/patients/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            insurance_number: insuranceNumber,
            birth_date: dobString,
          }),
        }
      );

      const data = await response.json();

      if (data.verified && data.patient) {
        onPatientFound(data.patient, data.visits || []);
      } else {
        // Patient not found - trigger create modal
        onPatientNotFound(insuranceNumber);
      }
    } catch (err) {
      setError("Error searching for patient");
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{
      padding: "15px",
      background: "#f0e2ea",
      border: "1px solid #999",
      marginBottom: "10px",
      borderRadius: "4px"
    }}>
      <h3 style={{ marginTop: 0, fontSize: "14px", fontWeight: "bold" }}>
        Patient Search / Load
      </h3>
      
      <div style={{ marginBottom: "10px" }}>
        <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", fontWeight: "bold" }}>
          Insurance Number:
        </label>
        <input
          type="text"
          value={insuranceNumber}
          onChange={(e) => setInsuranceNumber(e.target.value)}
          placeholder="Enter insurance number"
          style={{
            width: "100%",
            padding: "6px",
            border: "1px solid #bbb",
            fontSize: "12px"
          }}
        />
      </div>

      <div style={{ marginBottom: "10px" }}>
        <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", fontWeight: "bold" }}>
          Date of Birth (for verification):
        </label>
        <DatePicker
          selected={birthDate}
          onChange={(date: Date | null) => setBirthDate(date)}
          dateFormat="yyyy-MM-dd"
          placeholderText="Select date of birth"
          maxDate={new Date()}
          showYearDropdown
          showMonthDropdown
          dropdownMode="select"
          wrapperClassName="date-picker-wrapper"
          className="date-picker-input"
        />
      </div>

      {error && (
        <div style={{ color: "red", fontSize: "11px", marginBottom: "8px" }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSearch}
        disabled={searching}
        style={{
          width: "100%",
          padding: "8px",
          background: "#3366cc",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: searching ? "not-allowed" : "pointer",
          fontSize: "12px",
          fontWeight: "bold"
        }}
      >
        {searching ? "Searching..." : "Search / Load Patient"}
      </button>
    </div>
  );
}


