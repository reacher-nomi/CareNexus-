import React, { useState, useEffect } from "react";
import "./App.css";
import PatientSearch from "./components/PatientSearch";
import CreatePatientModal from "./components/CreatePatientModal";
import VisitHistory from "./components/VisitHistory";
import AuthForm from "./components/AuthForm";

const API_BASE = "http://localhost:5000/api";

interface Patient {
  id: number;
  first_name: string;
  last_name: string;
  birth_date: string;
  insurance_number?: string;
}

interface Visit {
  id: number;
  visit_date: string;
  visit_type: string;
  chief_complaint: string;
  notes: string;
  document_count: number;
}

interface Digestive {
  visit_date: string;
  digestive_inspection: string;
  digestive_auscultation: string;
  digestive_palpation: string;
  liver: string;
  rectal: string;
  smoker: number;
  insurance_type: string;
  notes: string;
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginData, setLoginData] = useState({ doctor_number: "", password: "" });
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingInsuranceNumber, setPendingInsuranceNumber] = useState("");
  const [currentVisitId, setCurrentVisitId] = useState<number | null>(null);
  const [digestive, setDigestive] = useState<Digestive>({
    visit_date: "",
    digestive_inspection: "",
    digestive_auscultation: "",
    digestive_palpation: "",
    liver: "",
    rectal: "",
    smoker: 0,
    insurance_type: "public",
    notes: "",
  });

  // Check if user is already logged in on app load
  useEffect(() => {
    fetch(`${API_BASE}/check-auth`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setIsLoggedIn(true);
        }
      })
      .catch(() => {
        // Not logged in, stay on login page
      });
  }, []);

  const handleLogin = () => {
    fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(loginData),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message) {
          setIsLoggedIn(true);
        } else {
          alert("Login failed");
        }
      })
      .catch((err) => console.error(err));
  };

  const handlePatientFound = (foundPatient: Patient, patientVisits: Visit[]) => {
    setPatient(foundPatient);
    setVisits(patientVisits);
    // Create a new visit for this session if no current visit
    if (patientVisits.length === 0 || !currentVisitId) {
      createNewVisit(foundPatient.id);
    }
  };

  const handlePatientNotFound = (insuranceNumber: string) => {
    setPendingInsuranceNumber(insuranceNumber);
    setShowCreateModal(true);
  };

  const handlePatientCreated = (newPatient: Patient) => {
    setPatient(newPatient);
    setVisits([]);
    setShowCreateModal(false);
    // Create a new visit for the new patient
    createNewVisit(newPatient.id);
  };

  const createNewVisit = async (patientId: number) => {
    try {
      const response = await fetch(`${API_BASE}/patients/${patientId}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          visit_date: new Date().toISOString().split("T")[0],
          visit_type: "general",
          chief_complaint: "",
          notes: "",
        }),
      });

      const data = await response.json();
      if (data.visit) {
        setCurrentVisitId(data.visit.id);
        // Refresh visits list
        loadPatientVisits(patientId);
      }
    } catch (err) {
      console.error("Error creating visit:", err);
    }
  };

  const loadPatientVisits = async (patientId: number) => {
    try {
      const response = await fetch(`${API_BASE}/patients/${patientId}`, {
        credentials: "include",
      });
      const data = await response.json();
      if (data.visits) {
        setVisits(data.visits);
      }
    } catch (err) {
      console.error("Error loading visits:", err);
    }
  };

  const calculateAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleDigestiveChange = (field: keyof Digestive, value: string | number) => {
    setDigestive({ ...digestive, [field]: value });
  };

  const saveDigestive = () => {
    if (!patient) return;
    fetch(`${API_BASE}/digestive/${patient.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(digestive),
    })
      .then((res) => res.json())
      .then((data) => alert("Saved"))
      .catch((err) => console.error(err));
  };


  if (!isLoggedIn) {
    return (
      <AuthForm onAuthSuccess={() => setIsLoggedIn(true)} />
    );
  }

  return (
    <div className="ehr-root">
      {/* Top bar */}
      <header className="ehr-topbar">
        <div className="ehr-title">Handy Patients Enterprise Edition</div>
        <div className="ehr-top-right">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </div>
      </header>

      <div className="ehr-main">
        {/* LEFT PANEL */}
        <aside className="ehr-left">
          {/* Patient Search */}
          <PatientSearch
            onPatientFound={handlePatientFound}
            onPatientNotFound={handlePatientNotFound}
          />

          {/* Patient header */}
          {patient ? (
            <>
              <div className="patient-header">
                <div className="patient-photo" />
                <div className="patient-info">
                  <div className="patient-name-row">
                    <span className="label">Last</span>
                    <span className="field wide">{patient.last_name}</span>
                  </div>
                  <div className="patient-name-row">
                    <span className="label">First</span>
                    <span className="field wide">{patient.first_name}</span>
                  </div>
                  <div className="patient-name-row">
                    <span className="label">Birth</span>
                    <span className="field wide">{patient.birth_date}</span>
                  </div>
                  <div className="patient-meta">
                    Age: {patient.birth_date ? calculateAge(patient.birth_date) : "N/A"}
                  </div>
                  {patient.insurance_number && (
                    <div className="patient-meta">
                      Insurance: {patient.insurance_number}
                    </div>
                  )}
                </div>
              </div>

              {/* Visit History */}
              <VisitHistory visits={visits} />
            </>
          ) : (
            <div className="panel">
              <div className="panel-title">No Patient Selected</div>
              <div style={{ padding: "10px", fontSize: "11px", color: "#666" }}>
                Use the search above to find or create a patient
              </div>
            </div>
          )}

          {/* Forms & Sheets */}
          <div className="panel">
            <div className="panel-title">Forms</div>
            <select className="list" size={6}>
              <option>Meeting (Doctor)</option>
              <option>Full status (Doctor)</option>
              <option>Assistant</option>
              <option>Billing</option>
            </select>
          </div>

          <div className="panel">
            <div className="panel-title">Sheets</div>
            <select className="list" size={6}>
              <option>O: Neurologic</option>
              <option>O: Vascular</option>
              <option>O: Cardiac</option>
              <option>O: Respiratory</option>
              <option>O: Abdomen</option>
            </select>
          </div>

          {/* Diagnosis & Notes */}
          {patient && (
            <>
              <div className="panel diagnosis">
                <div className="panel-title">Diagnosis</div>
                <textarea
                  className="notes"
                  rows={3}
                  value={digestive.notes || ""}
                  onChange={(e) => handleDigestiveChange("notes", e.target.value)}
                />
              </div>

              <div className="panel">
                <div className="panel-title">Notes</div>
                <textarea className="notes" rows={3} defaultValue="Father asks many questions, add 10 minutes to consultation" />
              </div>
            </>
          )}
        </aside>

        {/* CENTER PANEL */}
        <section className="ehr-center">
          {patient ? (
            <>
              <h2 className="section-title">Digestive</h2>

              <div className="field-row">
                <label>Digestive inspection</label>
                <input
                  type="text"
                  value={digestive.digestive_inspection || ""}
                  onChange={(e) => handleDigestiveChange("digestive_inspection", e.target.value)}
                />
              </div>
              <div className="field-row">
                <label>Digestive auscultation</label>
                <input
                  type="text"
                  value={digestive.digestive_auscultation || ""}
                  onChange={(e) => handleDigestiveChange("digestive_auscultation", e.target.value)}
                />
              </div>
              <div className="field-row">
                <label>Digestive palpation</label>
                <input
                  type="text"
                  value={digestive.digestive_palpation || ""}
                  onChange={(e) => handleDigestiveChange("digestive_palpation", e.target.value)}
                />
              </div>

              <div className="field-row">
                <label>Liver</label>
                <input
                  type="text"
                  value={digestive.liver || ""}
                  onChange={(e) => handleDigestiveChange("liver", e.target.value)}
                />
              </div>
              <div className="field-row">
                <label>Rectal</label>
                <input
                  type="text"
                  value={digestive.rectal || ""}
                  onChange={(e) => handleDigestiveChange("rectal", e.target.value)}
                />
              </div>

              {/* Smoker checkbox */}
              <div className="field-row">
                <label>
                  <input
                    type="checkbox"
                    checked={digestive.smoker === 1}
                    onChange={(e) => handleDigestiveChange("smoker", e.target.checked ? 1 : 0)}
                  />
                  Smoker
                </label>
              </div>

              {/* Insurance type radio */}
              <div className="field-row">
                <label>Insurance Type</label>
                <div>
                  <label>
                    <input
                      type="radio"
                      name="insurance"
                      value="public"
                      checked={digestive.insurance_type === "public"}
                      onChange={(e) => handleDigestiveChange("insurance_type", e.target.value)}
                    />
                    Public
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="insurance"
                      value="private"
                      checked={digestive.insurance_type === "private"}
                      onChange={(e) => handleDigestiveChange("insurance_type", e.target.value)}
                    />
                    Private
                  </label>
                </div>
              </div>

              {/* Bottom image area */}
              <div className="image-area">
                <div className="image-placeholder left">Patient photo / drawing</div>
                <div className="image-placeholder right">Digestive system diagram</div>
              </div>

              <div className="bottom-nav">
                <button onClick={saveDigestive}>Save</button>
                <div className="spacer" />
                <button>Documents manager</button>
                <div className="spacer" />
                <button>Previous page</button>
                <button>Next page</button>
              </div>
            </>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
              <h2>No Patient Selected</h2>
              <p>Please search for a patient using the search panel on the left.</p>
            </div>
          )}
        </section>
      </div>

      {/* Create Patient Modal */}
      {showCreateModal && (
        <CreatePatientModal
          insuranceNumber={pendingInsuranceNumber}
          onClose={() => setShowCreateModal(false)}
          onPatientCreated={handlePatientCreated}
        />
      )}
    </div>
  );
}

export default App;

