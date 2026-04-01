import React, { useState } from "react";
import { Lock, Mail, ChevronRight } from "lucide-react";

interface Props {
  onLogin: (email: string, pass: string) => Promise<boolean>;
  error: string | null;
}

export const LoginView: React.FC<Props> = ({ onLogin, error }) => {
  const [email, setEmail] = useState("yuvaraj@reidiusinfra.com");
  const [password, setPassword] = useState("Yuvaraj@2003");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <div className="login-container">
      <div className="login-card glass">
        <h1 className="brand-text">Admin Panel</h1>
        <p className="subtitle">Login to access dashboard</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <Mail size={20} className="input-icon" />
            <input
              type="email"
              placeholder="Email (yuvaraj@reidiusinfra.com)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <Lock size={20} className="input-icon" />
            <input
              type="password"
              placeholder="Password (Yuvaraj@2003)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary mt-4">
            Sign In <ChevronRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};
