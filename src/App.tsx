import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import MakePicks from "./components/MakePicks";
import GridView from "./components/GridView";
import Admin from "./components/Admin";
import "./App.css";

const App = () => {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <Router>
          <MainContent signOut={signOut || (() => { })} user={user} />
        </Router>
      )}
    </Authenticator>
  );
};

const MainContent = ({ signOut, user }: { signOut: () => void; user: any }) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        textAlign: "center",
      }}
    >
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<LandingPage user={user} />} />
          <Route path="/picks" element={<MakePicks user={user} />} />
          <Route path="/standings" element={<GridView />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>

      <footer className="app-footer">
        <button onClick={signOut} className="signout-button">
          Sign Out
        </button>
      </footer>
    </div>
  );
};

const LandingPage = ({ user }: { user: any }) => {
  return (
    <div className="landing-page">
      <div className="landing-hero">
        <img src="/header.png" alt="March Madness Knockout Pool 2026" className="landing-header-img" />
      </div>

      <p>Welcome, {user?.signInDetails?.loginId || "Player"}!</p>

      <div className="landing-links-container">
        <ul className="landing-links">
          <li>
            <Link to="/picks">MAKE PICKS</Link>
          </li>
          <li>
            <Link to="/standings">STANDINGS GRID</Link>
          </li>
          <li>
            <Link to="/admin" style={{ background: 'linear-gradient(135deg, #666 0%, #444 100%)', fontSize: '0.9rem' }}>ADMIN</Link>
          </li>
        </ul>
      </div>

      <div className="rules-section">
        <h2>Rules</h2>
        <ul style={{ textAlign: "left", display: "inline-block", maxWidth: "600px" }}>
          <li>$10 per entry (max 3 per person).</li>
          <li>Thursday: Pick TWO outright winners. Both must win.</li>
          <li>Friday: Pick TWO winners (or FOUR if buying back in).</li>
          <li>Sat/Sun/after: Pick ONE winner per day.</li>
          <li>Cannot pick the same team twice per entry.</li>
          <li>If knocked out, buybacks cost $10 (max 3 buybacks, none after 1st Sunday).</li>
          <li>Buybacks multiply picks required for next day!</li>
          <li>Last entry standing wins it all!</li>
        </ul>
      </div>
    </div>
  );
};

export default App;
