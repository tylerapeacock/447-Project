import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./Layout.css";
 
// Only these roles upload and download department data (see the SRS).
export const TRANSFER_ROLES = ["department_administrator"];
 
function Layout() {
  const { user, logout } = useAuth();
  const canTransfer = TRANSFER_ROLES.includes(user?.role);
 
  const links = [
    { to: "/dashboard", label: "Dashboard" },
    ...(canTransfer ? [{ to: "/data", label: "Import & export" }] : []),
    { to: "/settings", label: "Settings" },
  ];
 
  return (
    <div className="app-shell">
      <nav className="sidebar" aria-label="Main">
        <div className="sidebar-brand">Retriever Dashboard</div>
 
        <ul className="sidebar-links">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                className={({ isActive }) =>
                  isActive ? "sidebar-link active" : "sidebar-link"
                }
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
 
        <div className="sidebar-footer">
          <div className="sidebar-user">{user?.name}</div>
          <button type="button" className="sidebar-logout" onClick={logout}>
            Log out
          </button>
        </div>
      </nav>
 
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
 
export default Layout;