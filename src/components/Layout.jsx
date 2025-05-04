// Layout.jsx
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Nav } from 'react-bootstrap';

const Layout = () => {
  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: '#f8f9fa' }}>
      <div className="px-4 pt-4">
        <h4 className="fw-bold mb-3">🧠 AgentLens</h4>
        <Nav variant="tabs" className="mb-3">
          <Nav.Item>
            <NavLink to="/" className="nav-link">Tools</NavLink>
          </Nav.Item>
          <Nav.Item>
            <NavLink to="/metrics" className="nav-link">Overall Metrics</NavLink>
          </Nav.Item>
          <Nav.Item>
            <NavLink to="/flow" className="nav-link">Tool Flow</NavLink>
          </Nav.Item>
        </Nav>
      </div>

      <div className="px-4">
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;
