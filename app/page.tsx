
"use client";

import { useEffect, useMemo, useState } from "react";

type HistoryItem = {
  id: string;
  expression: string;
  result: string;
  createdAt: string;
};

type User = {
  userId: number;
  name: string;
  email: string;
};

const tools = ["Basic", "Percentage", "Average", "Ratio"];

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "Error";
  return Number(value.toPrecision(12)).toLocaleString("en-US", {
    maximumFractionDigits: 10,
  });
}

function calculateExpression(expression: string): number {
  const clean = expression
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-");

  if (!/^[0-9+\-*/().%\s]+$/.test(clean)) {
    throw new Error("Invalid expression");
  }

  const normalized = clean.replace(
    /(\d+(?:\.\d+)?)%/g,
    "($1/100)"
  );

  // Temporary evaluator; we will replace this with a safer parser later.
  
  const result = Function(`"use strict"; return (${normalized})`)();

  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Invalid result");
  }

  return result;
}

export default function Home() {
  const [expression, setExpression] = useState("0");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeTool, setActiveTool] = useState("Basic");
  const [justCalculated, setJustCalculated] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [percentValue, setPercentValue] = useState("250");
  const [percentRate, setPercentRate] = useState("15");
  const [averageValues, setAverageValues] = useState("10, 20, 30");
  const [ratioA, setRatioA] = useState("12");
  const [ratioB, setRatioB] = useState("18");

  // Check existing login session when the page opens.
  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();

        if (cancelled) return;

        if (data.authenticated && data.user) {
          setUser(data.user);

          const historyResponse = await fetch("/api/history");
          const historyData = await historyResponse.json();

          if (!cancelled && historyData.success) {
            setHistory(
              historyData.history.map((item: {
                history_id: number;
                expression: string;
                result: string;
                created_at: string;
              }) => ({
                id: String(item.history_id),
                expression: item.expression,
                result: item.result,
                createdAt: item.created_at,
              }))
            );
          }
        } else {
          loadGuestHistory();
        }
      } catch {
        if (!cancelled) loadGuestHistory();
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    function loadGuestHistory() {
      try {
        const saved = localStorage.getItem("calcspace-history");
        if (saved) {
          setHistory(JSON.parse(saved) as HistoryItem[]);
        }
      } catch {
        localStorage.removeItem("calcspace-history");
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  // Save history locally only in Guest Mode.
  useEffect(() => {
    if (ready && !user) {
      localStorage.setItem("calcspace-history", JSON.stringify(history));
    }
  }, [history, user, ready]);

  const preview = useMemo(() => {
    try {
      if (!expression || expression === "0") return "0";
      return formatNumber(calculateExpression(expression));
    } catch {
      return "";
    }
  }, [expression]);

  async function refreshServerHistory() {
    const response = await fetch("/api/history");
    const data = await response.json();

    if (data.success) {
      setHistory(
        data.history.map((item: {
          history_id: number;
          expression: string;
          result: string;
          created_at: string;
        }) => ({
          id: String(item.history_id),
          expression: item.expression,
          result: item.result,
          createdAt: item.created_at,
        }))
      );
    }
  }

  async function addHistory(expr: string, result: string) {
    if (!user) {
      setHistory((current) => [
        {
          id: crypto.randomUUID(),
          expression: expr,
          result,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 100));

      return;
    }

    try {
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expression: expr,
          result,
          calculationType: "basic",
        }),
      });

      await refreshServerHistory();
    } catch {
      console.error("Could not save calculation.");
    }
  }

  function press(value: string) {
    setExpression((current) => {
      if (value === "AC") return "0";

      if (value === "DEL") {
        return current.length > 1 ? current.slice(0, -1) : "0";
      }

      if (value === "=") {
        try {
          const result = formatNumber(calculateExpression(current));
          void addHistory(current, result);
          setJustCalculated(true);
          return result.replace(/,/g, "");
        } catch {
          return "Error";
        }
      }

      if (value === "±") {
        return current.startsWith("-")
          ? current.slice(1)
          : `-${current}`;
      }

      if (current === "Error" || justCalculated) {
        setJustCalculated(false);
        return /[0-9.]/.test(value) ? value : current + value;
      }

      setJustCalculated(false);
      return current === "0" && /[0-9.]/.test(value)
        ? value
        : current + value;
    });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (/^[0-9.]$/.test(event.key)) press(event.key);
      else if (["+", "-", "*", "/", "(", ")", "%"].includes(event.key)) {
        press(event.key);
      } else if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        press("=");
      } else if (event.key === "Backspace") {
        press("DEL");
      } else if (event.key === "Escape") {
        press("AC");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  async function handleAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage("");

    try {
      if (authMode === "register") {
        const registerResponse = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: authName,
            email: authEmail,
            password: authPassword,
          }),
        });

        const registerData = await registerResponse.json();

        if (!registerResponse.ok) {
          setAuthMessage(registerData.message || "Registration failed.");
          return;
        }
      }

      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
        }),
      });

      const loginData = await loginResponse.json();

      if (!loginResponse.ok) {
        setAuthMessage(loginData.message || "Login failed.");
        return;
      }

      setUser(loginData.user);
      await refreshServerHistory();

      setAuthMode(null);
      setAuthName("");
      setAuthEmail("");
      setAuthPassword("");
      setAuthMessage("");
    } catch {
      setAuthMessage("Something went wrong. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });

      const saved = localStorage.getItem("calcspace-history");
      const guestHistory = saved
        ? (JSON.parse(saved) as HistoryItem[])
        : [];

      setHistory(guestHistory);
      setUser(null);
      setAuthMode(null);
    } catch {
      setAuthMessage("Could not log out. Please try again.");
    }
  }

  function exportHistory(format: "csv" | "txt") {
    const rows = [
      ["Expression", "Result", "Date"],
      ...history.map((item) => [
        item.expression,
        item.result,
        new Date(item.createdAt).toLocaleString(),
      ]),
    ];

    const content = format === "csv"
      ? rows.map((row) =>
          row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
        ).join("\n")
      : rows.map((row) => row.join(" | ")).join("\n");

    const blob = new Blob([content], {
      type: format === "csv"
        ? "text/csv;charset=utf-8"
        : "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `calcspace-history.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function clearHistory() {
    if (!confirm("Clear all calculation history?")) return;

    if (!user) {
      setHistory([]);
      return;
    }

    try {
      await Promise.all(
        history.map((item) =>
          fetch(`/api/history/${item.id}`, { method: "DELETE" })
        )
      );

      setHistory([]);
    } catch {
      alert("Could not clear history. Please try again.");
    }
  }

  const buttons = [
    ["AC", "±", "%", "÷"],
    ["7", "8", "9", "×"],
    ["4", "5", "6", "−"],
    ["1", "2", "3", "+"],
    ["DEL", "0", ".", "="],
  ];

  const percentResult = Number(percentValue) * Number(percentRate) / 100;

  const averageList = averageValues
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "")
    .map(Number)
    .filter(Number.isFinite);

  const averageResult = averageList.length
    ? averageList.reduce((a, b) => a + b, 0) / averageList.length
    : NaN;

  const gcd = (a: number, b: number): number =>
    b === 0 ? Math.abs(a) : gcd(b, a % b);

  const divisor = gcd(
    Math.round(Number(ratioA)),
    Math.round(Number(ratioB))
  );

  const ratioResult =
    Number.isFinite(divisor) && divisor > 0
      ? `${Number(ratioA) / divisor}:${Number(ratioB) / divisor}`
      : "—";

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-mark">÷</span>
          <span>Calc<span className="brand-accent">Space</span></span>
        </a>

        <nav>
          <a href="#calculator">Calculator</a>
          <a href="#tools">Tools</a>
          <a href="#history">History</a>
        </nav>

        <div className="account-area">
          {!ready ? (
            <span className="top-pill">Loading...</span>
          ) : user ? (
            <>
              <span className="top-pill">Hi, {user.name}</span>
              <button className="account-button" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <button
              className="account-button"
              onClick={() => {
                setAuthMode("login");
                setAuthMessage("");
              }}
            >
              Login
            </button>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow"><span /> YOUR EVERYDAY CALCULATION SPACE</div>
        <h1>Make numbers<br /><span>make sense.</span></h1>
        <p>A simple, focused calculator with handy tools for everyday math.</p>
      </section>

      {authMode && !user && (
        <section className="auth-section">
          <div className="auth-card">
            <div className="card-heading">
              <div>
                <span className="mini-label">CALCSPACE ACCOUNT</span>
                <h2>{authMode === "login" ? "Welcome back" : "Create your account"}</h2>
              </div>
              <button
                className="auth-close"
                onClick={() => setAuthMode(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p className="auth-description">
              {authMode === "login"
                ? "Log in to access your personal calculation history."
                : "Create an account to save your calculations online."}
            </p>

            <form className="auth-form" onSubmit={handleAuth}>
              {authMode === "register" && (
                <label>
                  Full name
                  <input
                    value={authName}
                    onChange={(event) => setAuthName(event.target.value)}
                    placeholder="Your name"
                    required
                  />
                </label>
              )}

              <label>
                Email address
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </label>

              {authMessage && <p className="auth-message">{authMessage}</p>}

              <button className="auth-submit" type="submit" disabled={authLoading}>
                {authLoading
                  ? "Please wait..."
                  : authMode === "login"
                    ? "Login"
                    : "Create account"}
              </button>
            </form>

            <p className="auth-switch">
              {authMode === "login"
                ? "Don't have an account?"
                : "Already have an account?"}
              {" "}
              <button
                onClick={() => {
                  setAuthMode(authMode === "login" ? "register" : "login");
                  setAuthMessage("");
                }}
              >
                {authMode === "login" ? "Create account" : "Login"}
              </button>
            </p>

            <button
              className="guest-button"
              onClick={() => setAuthMode(null)}
            >
              Continue as Guest
            </button>
          </div>
        </section>
      )}

      <section className="workspace" id="calculator">
        <div className="calculator-card">
          <div className="card-heading">
            <div>
              <span className="mini-label">CALCULATOR</span>
              <h2>Basic calculator</h2>
            </div>
            <span className="keyboard-hint">⌨ Keyboard supported</span>
          </div>

          <div className="display">
            <div className="expression">{expression}</div>
            <div className="result">
              {preview && expression !== "0" ? `= ${preview}` : " "}
            </div>
          </div>

          <div className="keypad">
            {buttons.flat().map((key) => (
              <button
                key={key}
                className={`key ${
                  ["÷", "×", "−", "+"].includes(key) ? "operator" : ""
                } ${key === "=" ? "equals" : ""} ${
                  ["AC", "DEL", "±", "%"].includes(key) ? "utility" : ""
                }`}
                onClick={() => press(key)}
                aria-label={key === "DEL" ? "Delete" : key}
              >
                {key === "DEL" ? "⌫" : key}
              </button>
            ))}
          </div>

          <p className="calculator-footnote">
            Tip: use your keyboard · Enter to calculate · Esc to clear
          </p>
        </div>

        <aside className="side-panel" id="history">
          <div className="card-heading">
            <div>
              <span className="mini-label">YOUR ACTIVITY</span>
              <h2>Recent history</h2>
            </div>
            <span className="count-badge">{history.length}</span>
          </div>

          <div className="history-list">
            {!ready ? (
              <div className="empty-state">Loading history...</div>
            ) : history.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">↗</div>
                <strong>No calculations yet</strong>
                <span>Your recent calculations will appear here.</span>
              </div>
            ) : (
              history.slice(0, 7).map((item) => (
                <button
                  className="history-item"
                  key={item.id}
                  onClick={() => {
                    setExpression(item.expression);
                    setActiveTool("Basic");
                  }}
                >
                  <span>
                    <small>{item.expression}</small>
                    <strong>{item.result}</strong>
                  </span>
                  <time>
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </button>
              ))
            )}
          </div>

          <div className="history-actions">
            <button
              className="text-button"
              onClick={() => exportHistory("csv")}
              disabled={!history.length}
            >
              Export CSV
            </button>
            <button
              className="text-button"
              onClick={() => exportHistory("txt")}
              disabled={!history.length}
            >
              Export TXT
            </button>
            <button
              className="text-button danger-text"
              onClick={clearHistory}
              disabled={!history.length}
            >
              Clear
            </button>
          </div>

          <p className="privacy-note">
            {user
              ? "Your history is saved securely to your account."
              : "Guest history stays in this browser on this device."}
          </p>
        </aside>
      </section>

      <section className="tools-section" id="tools">
        <div className="section-heading">
          <div>
            <span className="mini-label">MORE THAN A CALCULATOR</span>
            <h2>Quick calculation tools</h2>
          </div>
          <span className="section-note">Useful extras, all in one place.</span>
        </div>

        <div className="tool-tabs">
          {tools.map((tool) => (
            <button
              key={tool}
              className={activeTool === tool ? "active" : ""}
              onClick={() => setActiveTool(tool)}
            >
              {tool}
            </button>
          ))}
        </div>

        <div className="tool-card">
          {activeTool === "Basic" && (
            <div className="tool-intro">
              <span className="tool-icon">＋</span>
              <div>
                <h3>Basic calculator</h3>
                <p>Use the calculator above for quick arithmetic.</p>
              </div>
            </div>
          )}

          {activeTool === "Percentage" && (
            <div className="tool-form">
              <div>
                <h3>Percentage calculator</h3>
                <p>Find a percentage of any number.</p>
              </div>
              <label>
                What is
                <input
                  value={percentRate}
                  onChange={(event) => setPercentRate(event.target.value)}
                  inputMode="decimal"
                />
                % of
                <input
                  value={percentValue}
                  onChange={(event) => setPercentValue(event.target.value)}
                  inputMode="decimal"
                />
                ?
              </label>
              <div className="tool-result">
                {Number.isFinite(percentResult)
                  ? formatNumber(percentResult)
                  : "Enter valid numbers"}
              </div>
            </div>
          )}

          {activeTool === "Average" && (
            <div className="tool-form">
              <div>
                <h3>Average calculator</h3>
                <p>Enter numbers separated by commas.</p>
              </div>
              <label>
                Numbers
                <input
                  className="wide-input"
                  value={averageValues}
                  onChange={(event) => setAverageValues(event.target.value)}
                />
              </label>
              <div className="tool-result">
                {Number.isFinite(averageResult)
                  ? formatNumber(averageResult)
                  : "Enter valid numbers"}
              </div>
            </div>
          )}

          {activeTool === "Ratio" && (
            <div className="tool-form">
              <div>
                <h3>Ratio simplifier</h3>
                <p>Reduce a ratio to its simplest form.</p>
              </div>
              <label>
                First value
                <input
                  value={ratioA}
                  onChange={(event) => setRatioA(event.target.value)}
                  inputMode="decimal"
                />
              </label>
              <label>
                Second value
                <input
                  value={ratioB}
                  onChange={(event) => setRatioB(event.target.value)}
                  inputMode="decimal"
                />
              </label>
              <div className="tool-result">{ratioResult}</div>
            </div>
          )}
        </div>
      </section>

      <footer>
        <a className="brand" href="#">
          <span className="brand-mark">÷</span>
          <span>Calc<span className="brand-accent">Space</span></span>
        </a>
        <span>Made for clear calculations.</span>
        <span>© {new Date().getFullYear()} CalcSpace</span>
      </footer>
    </main>
  );
}
