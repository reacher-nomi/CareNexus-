import React, { useState } from "react";

const API_BASE = "http://localhost:5000/api";

type Mode = "login" | "register";

export default function AuthForm({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    doctor_number: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    if (mode === "login") {
      // Login
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          doctor_number: form.doctor_number,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setMessage("Login successful!");
        onAuthSuccess();
      } else {
        setMessage(data.error || "Login failed.");
      }
    } else {
      // Register
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          doctor_number: form.doctor_number,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setMessage("Registration successful! Please log in.");
        setMode("login");
        setForm({ name: "", email: "", doctor_number: "", password: "" });
      } else {
        setMessage(data.error || "Registration failed.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="auth-form-wrapper" style={{ padding: 24, maxWidth: 400, margin: "50px auto", background: "#fff", borderRadius: 8 }}>
      <h2 style={{ textAlign: "center" }}>
        {mode === "login" ? "Doctor Login" : "Register as Doctor"}
      </h2>
      <form onSubmit={handleSubmit}>
        {mode === "register" && (
          <>
            <input
              name="name"
              placeholder="Full Name"
              value={form.name}
              onChange={handleChange}
              required
              style={{ width: "100%", margin: "8px 0", padding: "8px" }}
            />
            <input
              name="email"
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              style={{ width: "100%", margin: "8px 0", padding: "8px" }}
            />
          </>
        )}
        <input
          name="doctor_number"
          placeholder="Doctor ID"
          value={form.doctor_number}
          onChange={handleChange}
          required
          style={{ width: "100%", margin: "8px 0", padding: "8px" }}
        />
        <input
          name="password"
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={handleChange}
          required
          style={{ width: "100%", margin: "8px 0", padding: "8px" }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", margin: "8px 0", padding: "8px", background: "#3366cc", color: "#fff", border: "none" }}
        >
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
        </button>
      </form>
      <div style={{ textAlign: "center", marginTop: 8 }}>
        {mode === "login" ? (
          <span>
            Not registered?{" "}
            <button type="button" onClick={() => { setMode("register"); setMessage(""); }} style={{ color: "#3366cc", background: "none", border: 0, cursor: "pointer" }}>
              Sign up here
            </button>
          </span>
        ) : (
          <span>
            Already registered?{" "}
            <button type="button" onClick={() => { setMode("login"); setMessage(""); }} style={{ color: "#3366cc", background: "none", border: 0, cursor: "pointer" }}>
              Login here
            </button>
          </span>
        )}
      </div>
      {message && <div style={{ marginTop: 12, color: message.includes("successful") ? "green" : "red", textAlign: "center" }}>{message}</div>}
    </div>
  );
}

