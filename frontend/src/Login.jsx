import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "./api/api";
import { useAuth } from "./AuthContext";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const { setUser } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Enter both your email and password.");
      return;
    }

    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      setUser(user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <img className="login-logo" src="/UMBCLogo.jpeg" alt="UMBC" />
        <h1 className="login-title">Retriever Dashboard</h1>
        <p className="login-subtitle">Sign in to continue</p>

        <label className="login-label" htmlFor="email">Email</label>
        <input
          id="email"
          className="login-input"
          type="text"
          autoComplete="username"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
        />

        <label className="login-label" htmlFor="password">Password</label>
        <input
          id="password"
          className="login-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
        />

        {error && <p className="login-error">{error}</p>}

        <button className="login-button" type="submit" disabled={busy}>
          {busy ? "Signing in..." : "Log in"}
        </button>
      </form>
    </div>
  );
}

export default Login;