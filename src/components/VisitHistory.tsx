import React from "react";

interface Visit {
  id: number;
  visit_date: string;
  visit_type: string;
  chief_complaint: string;
  notes: string;
  document_count: number;
}

interface VisitHistoryProps {
  visits: Visit[];
  onVisitSelect?: (visitId: number) => void;
}

export default function VisitHistory({ visits, onVisitSelect }: VisitHistoryProps) {
  if (visits.length === 0) {
    return (
      <div className="panel">
        <div className="panel-title">Visit History</div>
        <div style={{ padding: "10px", fontSize: "11px", color: "#666" }}>
          No previous visits
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-title">Visit History</div>
      <div style={{ maxHeight: "200px", overflowY: "auto" }}>
        {visits.map((visit) => (
          <div
            key={visit.id}
            onClick={() => onVisitSelect && onVisitSelect(visit.id)}
            style={{
              padding: "6px",
              marginBottom: "4px",
              background: "#f9f9f9",
              border: "1px solid #ddd",
              borderRadius: "3px",
              cursor: onVisitSelect ? "pointer" : "default",
              fontSize: "11px",
            }}
          >
            <div style={{ fontWeight: "bold" }}>
              {new Date(visit.visit_date).toLocaleDateString()}
            </div>
            <div style={{ color: "#666", fontSize: "10px" }}>
              Type: {visit.visit_type}
            </div>
            {visit.chief_complaint && (
              <div style={{ color: "#666", fontSize: "10px", marginTop: "2px" }}>
                {visit.chief_complaint.substring(0, 50)}
                {visit.chief_complaint.length > 50 ? "..." : ""}
              </div>
            )}
            {visit.document_count > 0 && (
              <div style={{ color: "#3366cc", fontSize: "10px", marginTop: "2px" }}>
                {visit.document_count} document(s)
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


