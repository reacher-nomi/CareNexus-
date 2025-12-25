import React from "react";

interface FormSelectorProps {
  onFormSelect: (formType: string) => void;
}

export default function FormSelector({ onFormSelect }: FormSelectorProps) {
  return (
    <div className="panel">
      <div className="panel-title">Forms</div>
      <select
        className="list"
        size={6}
        onChange={(e) => onFormSelect(e.target.value)}
      >
        <option value="">Select a form...</option>
        <option value="meeting">Meeting (Doctor)</option>
        <option value="full_status">Full status (Doctor)</option>
        <option value="assistant">Assistant</option>
        <option value="billing">Billing</option>
      </select>
    </div>
  );
}
