import React, { useState, useEffect } from "react";
import "./App.css";
import PatientSearch from "./components/PatientSearch";
import CreatePatientModal from "./components/CreatePatientModal";
import VisitHistory from "./components/VisitHistory";
import AuthForm from "./components/AuthForm";
import SheetForm from "./components/SheetForm";
import DocumentManager from "./components/DocumentManager";

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

// Define sheet order for navigation
const SHEET_ORDER = ["digestive", "neurologic", "vascular", "cardiac", "respiratory", "abdomen"] as const;
type SheetType = typeof SHEET_ORDER[number];

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingInsuranceNumber, setPendingInsuranceNumber] = useState("");
  const [currentVisitId, setCurrentVisitId] = useState<number | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<SheetType | null>(null);
  const [showDocManager, setShowDocManager] = useState(false);
  const [searchKey, setSearchKey] = useState(0); // Force PatientSearch to reset
  
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

  useEffect(() => {
    fetch(`${API_BASE}/check-auth`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (data.authenticated) {
          setIsLoggedIn(true);
        }
      })
      .catch(() => {});
  }, []);

  const handlePatientFound = (foundPatient: Patient, patientVisits: Visit[]) => {
    setPatient(foundPatient);
    setVisits(patientVisits);
    setSelectedSheet(null); // Reset to default view
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
    setSelectedSheet(null);
    setSearchKey(prev => prev + 1); // Force search component to reset
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
      .then(() => alert("Saved"))
      .catch((err) => console.error(err));
  };

  // Navigation helpers
  const navigateSheet = (direction: "next" | "prev") => {
    const currentIndex = selectedSheet ? SHEET_ORDER.indexOf(selectedSheet) : 0;
    let newIndex;
    
    if (direction === "next") {
      newIndex = (currentIndex + 1) % SHEET_ORDER.length;
    } else {
      newIndex = (currentIndex - 1 + SHEET_ORDER.length) % SHEET_ORDER.length;
    }
    
    setSelectedSheet(SHEET_ORDER[newIndex]);
  };

  if (!isLoggedIn) {
    return <AuthForm onAuthSuccess={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="ehr-root">
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
        <aside className="ehr-left">
          <PatientSearch
            key={searchKey}
            onPatientFound={handlePatientFound}
            onPatientNotFound={handlePatientNotFound}
          />

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
                    <div className="patient-meta">Insurance: {patient.insurance_number}</div>
                  )}
                </div>
              </div>

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

          <div className="panel">
            <div className="panel-title">Forms</div>
            <select
              className="list"
              size={6}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "custom") {
                  alert("Custom form builder coming soon!");
                } else if (value) {
                  alert(`Form "${value}" not yet implemented`);
                }
                e.target.value = "";
              }}
            >
              <option value="">Select a form...</option>
              <option value="meeting">Meeting (Doctor)</option>
              <option value="full_status">Full status (Doctor)</option>
              <option value="assistant">Assistant</option>
              <option value="billing">Billing</option>
              <option value="custom">+ Create Custom Form</option>
            </select>
          </div>

          <div className="panel">
            <div className="panel-title">Sheets</div>
            <select
              className="list"
              size={6}
              value={selectedSheet || ""}
              onChange={(e) => {
                const value = e.target.value as SheetType;
                setSelectedSheet(value || null);
              }}
            >
              <option value="">Select a sheet...</option>
              <option value="digestive">Digestive</option>
              <option value="neurologic">O: Neurologic</option>
              <option value="vascular">O: Vascular</option>
              <option value="cardiac">O: Cardiac</option>
              <option value="respiratory">O: Respiratory</option>
              <option value="abdomen">O: Abdomen</option>
            </select>
          </div>

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
                <textarea
                  className="notes"
                  rows={3}
                  defaultValue="Father asks many questions, add 10 minutes to consultation"
                />
              </div>
            </>
          )}
        </aside>

        <section className="ehr-center">
          {!patient ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
              <h2>No Patient Selected</h2>
              <p>Please search for a patient using the search panel on the left.</p>
            </div>
          ) : selectedSheet && selectedSheet !== "digestive" ? (
            <SheetForm
              patientId={patient.id}
              visitId={currentVisitId || 0}
              sheetType={selectedSheet}
              onSave={() => {
                console.log("Sheet saved");
                loadPatientVisits(patient.id);
              }}
              onBack={() => setSelectedSheet(null)}
            />
          ) : (
            <>
              <h2 className="section-title">Digestive</h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                    Digestive inspection
                  </label>
                  <textarea
                    rows={3}
                    value={digestive.digestive_inspection || ""}
                    onChange={(e) => handleDigestiveChange("digestive_inspection", e.target.value)}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ccc", fontSize: "13px" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                    Digestive auscultation
                  </label>
                  <textarea
                    rows={3}
                    value={digestive.digestive_auscultation || ""}
                    onChange={(e) => handleDigestiveChange("digestive_auscultation", e.target.value)}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ccc", fontSize: "13px" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                    Digestive palpation
                  </label>
                  <textarea
                    rows={3}
                    value={digestive.digestive_palpation || ""}
                    onChange={(e) => handleDigestiveChange("digestive_palpation", e.target.value)}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ccc", fontSize: "13px" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Liver</label>
                  <textarea
                    rows={3}
                    value={digestive.liver || ""}
                    onChange={(e) => handleDigestiveChange("liver", e.target.value)}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ccc", fontSize: "13px" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Rectal</label>
                  <textarea
                    rows={3}
                    value={digestive.rectal || ""}
                    onChange={(e) => handleDigestiveChange("rectal", e.target.value)}
                    style={{ width: "100%", padding: "8px", border: "1px solid #ccc", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div style={{ marginTop: "20px" }}>
                <label>
                  <input
                    type="checkbox"
                    checked={digestive.smoker === 1}
                    onChange={(e) => handleDigestiveChange("smoker", e.target.checked ? 1 : 0)}
                  />
                  Smoker
                </label>
              </div>

              <div style={{ marginTop: "15px" }}>
                <label style={{ marginRight: "20px" }}>Insurance Type:</label>
                <label style={{ marginRight: "15px" }}>
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

              <div className="image-area">
                <div className="image-placeholder left">Patient photo / drawing</div>
                <div className="image-placeholder right">Digestive system diagram</div>
              </div>

              <div className="bottom-nav">
                <button onClick={saveDigestive}>Save</button>
                <div className="spacer" />
                <button onClick={() => setShowDocManager(true)}>Documents manager</button>
                <div className="spacer" />
                <button onClick={() => navigateSheet("prev")}>Previous page</button>
                <button onClick={() => navigateSheet("next")}>Next page</button>
              </div>
            </>
          )}
        </section>
      </div>

      {showCreateModal && (
        <CreatePatientModal
          insuranceNumber={pendingInsuranceNumber}
          onClose={() => setShowCreateModal(false)}
          onPatientCreated={handlePatientCreated}
        />
      )}

      {showDocManager && currentVisitId && (
        <DocumentManager visitId={currentVisitId} onClose={() => setShowDocManager(false)} />
      )}
    </div>
  );
}

export default App;
