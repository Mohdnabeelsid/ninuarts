import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Shield, Sparkles, ArrowRight, Lock, Mail, AlertCircle } from "lucide-react";

export function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const isDev = import.meta.env.DEV;
  const [email, setEmail] = useState(isDev ? "nidha@ninuarts.com" : "");
  const [password, setPassword] = useState(isDev ? "Password@123" : "");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Redirect if already authenticated based on role permissions
  React.useEffect(() => {
    if (isAuthenticated && user) {
      navigate(user.role === "OWNER" ? "/dashboard" : "/orders", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      const authedUser = await login(email, password);
      navigate(authedUser.role === "OWNER" ? "/dashboard" : "/orders", { replace: true });
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        "Invalid operator credentials or unable to reach backend service.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const prefillAccount = (prefillEmail: string) => {
    setEmail(prefillEmail);
    setPassword("Password@123");
    setErrorMessage("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F4F0] p-4 text-[#34312F] font-sans selection:bg-[#E8D8D4] selection:text-[#34312F]">
      <div className="w-full max-w-md">
        {/* Brand Monogram Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#34312F] text-white shadow-soft">
            <span className="font-serif text-2xl tracking-widest">N</span>
          </div>
          <h1 className="font-serif text-3xl font-normal tracking-tight text-[#34312F]">
            Ninu Arts
          </h1>
          <p className="mt-1 text-xs text-[#817872] uppercase tracking-widest font-medium">
            Business Manager • Alappuzha, Kerala
          </p>
        </div>

        {/* Card Form */}
        <div className="rounded-2xl border border-[#E7E1D8] bg-white p-8 shadow-card">
          <div className="mb-6">
            <h2 className="font-serif text-xl font-normal text-[#34312F]">Operator Sign In</h2>
            <p className="text-xs text-[#817872] mt-0.5">
              Enter your credentials to access business commands and records.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-[#FAECEB] border border-[#F2D0CE] p-3 text-xs text-[#8F352A]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#C96A5B]" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#817872] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[#817872]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nidha@ninuarts.com"
                  required
                  className="w-full h-10 rounded-xl border border-[#E7E1D8] bg-white pl-10 pr-3 text-xs text-[#34312F] focus:border-[#34312F] focus:outline-none focus:ring-1 focus:ring-[#34312F] transition-all shadow-card"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#817872] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#817872]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full h-10 rounded-xl border border-[#E7E1D8] bg-white pl-10 pr-3 text-xs text-[#34312F] focus:border-[#34312F] focus:outline-none focus:ring-1 focus:ring-[#34312F] transition-all shadow-card"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex w-full h-10 items-center justify-center gap-2 rounded-xl bg-[#34312F] font-medium text-xs text-white shadow-soft hover:bg-[#1F1D1C] active:scale-[0.99] transition-all disabled:opacity-50"
            >
              <span>{isLoading ? "Authenticating via Laravel API..." : "Sign In to Workspace"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Quick Pre-Fill Credential Buttons (Development Only) */}
          {isDev && (
            <div className="mt-6 border-t border-[#F0ECE7] pt-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#817872] text-center mb-2.5">
                Available Development Accounts
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => prefillAccount("nidha@ninuarts.com")}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[#E7E1D8] bg-[#F7F4F0] px-3 py-2 text-xs font-medium text-[#34312F] hover:bg-[#F0ECE7] transition-colors"
                >
                  <Shield className="h-3.5 w-3.5 text-[#34312F]" />
                  <span>Nidha (Owner)</span>
                </button>
                <button
                  type="button"
                  onClick={() => prefillAccount("staff@ninuarts.com")}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[#E7E1D8] bg-[#F7F4F0] px-3 py-2 text-xs font-medium text-[#34312F] hover:bg-[#F0ECE7] transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#817872]" />
                  <span>Staff Member</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footnote */}
        <p className="mt-6 text-center text-xs text-[#817872]">
          Ninu Arts Business Manager • Connected to Laravel REST API with Sanctum
        </p>
      </div>
    </div>
  );
}
