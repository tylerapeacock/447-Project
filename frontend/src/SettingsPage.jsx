import { useEffect, useState } from "react";
import { getDepartments } from "./api/api";
import { useAuth } from "./AuthContext";
import "./Pages.css";

const ROLE_NAMES = {
  dean: "Dean of Students",
  vp: "Vice President",
  director: "Director",
  assistant_director: "Assistant Director",
  department_administrator: "Department Administrator",
};

function SettingsPage() {
  const { user, logout } = useAuth();
  const [department, setDepartment] = useState(null);

  useEffect(() => {
    if (user?.department_id == null) return;
    getDepartments()
      .then((rows) => {
        const match = rows.find((d) => d["Department ID"] === user.department_id);
        setDepartment(match ? match["Department Name"] : `Department ${user.department_id}`);
      })
      .catch(() => setDepartment(`Department ${user.department_id}`));
  }, [user?.department_id]);

  const access =
    user?.department_id == null
      ? "All departments, view only"
      : department ?? "Loading…";

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>

      <section className="page-card">
        <h2 className="page-card-title">Account</h2>
        <dl className="page-details">
          <dt>Name</dt>
          <dd>{user?.name}</dd>
          <dt>Email</dt>
          <dd>{user?.email}</dd>
          <dt>Role</dt>
          <dd>{ROLE_NAMES[user?.role] ?? user?.role}</dd>
          <dt>Data access</dt>
          <dd>{access}</dd>
        </dl>
        <p className="page-text page-muted">
          To change your role or department, contact the dashboard administrator.
        </p>
      </section>

      <section className="page-card">
        <h2 className="page-card-title">Session</h2>
        <p className="page-text">
          For security, you're signed out automatically after a set time.
        </p>
        <button type="button" className="page-button page-button-secondary" onClick={logout}>
          Log out
        </button>
      </section>
    </div>
  );
}

export default SettingsPage;