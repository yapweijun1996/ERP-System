# 🔷 Nexus ERP Prototype

> **v3.3.0** | High-Fidelity Enterprise SaaS UI Kit

**Nexus ERP** is a comprehensive, browser-based prototype demonstrating advanced frontend architecture for multi-tenant enterprise applications. It simulates a complete SaaS ecosystem (Platform ➔ Tenant ➔ Company) running entirely in the browser using **React 19**, **TypeScript**, and **Tailwind CSS**.

![Status](https://img.shields.io/badge/Status-Prototype-orange)
![Stack](https://img.shields.io/badge/Tech-React_19_•_Tailwind_•_TypeScript_•_ESM-blue)
![Architecture](https://img.shields.io/badge/Architecture-Local--First_•_Zero--Build-green)

## 🌟 Core Capabilities

### 🏢 Multi-Tenant Hierarchy
*   **Platform Console**: Super-admin interface for managing Tenants, monitoring system health, and viewing global audit logs (`/admin/*`).
*   **Tenant Administration**: Client-level management for subscriptions, feature flags, user directories, and billing (`/client/*`).
*   **Company Workspace**: Operational ERP view. Context-aware switching between different legal entities (e.g., US Branch vs EU Branch).

### 🚀 Business Modules
*   **Sales & CRM**: Complete Quote-to-Cash workflow. Includes document numbering configuration, approval logic (>10% discount), and PDF-style rendering.
*   **Inventory**: Stock management with multi-warehouse support, adjustments, and movement history.
*   **Finance**: General Ledger (GL) transaction recording, profit/loss visualization, and tax configuration.
*   **Procurement**: Purchase Order (PO) management and Goods Received Notes (GRN).
*   **HR & Organization**: Employee directory, department structure, and Role-Based Access Control (RBAC).
*   **Support Desk**: Integrated ticketing system with internal notes, status workflows, and audit timelines.

### 🎨 UX & Engineering Patterns
*   **Customizable Dashboard**: Drag-and-drop grid layout engine allowing users to personalize their workspace widgets (`react-grid-layout` simulation).
*   **Command Palette**: Global search and action runner (`Cmd+K`) for keyboard-first navigation.
*   **Mini-Tools Engine**: Extensible utility framework for embedded calculators (e.g., Volumetric Weight, FX Converter).
*   **Onboarding Wizard**: Step-by-step provisioning flow for new tenants using complex form state management.
*   **Local-First Data**: Uses **IndexedDB** for persistence of users and session data, combined with `AppContext` for relational data simulation.
*   **Performance Mode**: Toggleable setting to reduce visual effects (blur/animations) for lower-end devices.

---

## 🛠 Technical Overview

This project uses a **Zero-Build** architecture via ES Modules. It runs directly in modern browsers without a Node.js build step during development, leveraging `esm.sh` for dependencies.

### Key Libraries
*   **React 19**: Utilizing standard Hooks (`useContext`, `useMemo`, `useReducer`) for state.
*   **Tailwind CSS**: Utility-first styling via CDN.
*   **Lucide React**: Consistent, lightweight iconography.
*   **Recharts**: Data visualization for dashboards and analytics.

### File Structure
```text
/
├── components/         # UI Building Blocks
│   ├── Dashboard/      # Widgets & Layout Engine
│   ├── Layout/         # App Shell (Sidebar, TopBar)
│   ├── Notifications/  # Inbox & Alert System
│   ├── Sales/          # Domain-specific components
│   ├── Tickets/        # Support Desk UI
│   ├── Tools/          # Calculator Tools Framework
│   └── UI/             # Generics (Modal, Table, Toast)
├── config/             # Menu & Route definitions
├── context/            # Global State (The "Database")
├── data/               # Mock Data Seeds (Tenants, Users, Docs)
├── pages/              # Route Controllers
│   ├── admin/          # Platform Views
│   ├── analytics/      # BI Dashboards
│   ├── auth/           # Login & Onboarding
│   ├── billing/        # Invoice Management
│   ├── client/         # Tenant Settings
│   ├── company/        # Operational Modules
│   ├── finance/        # GL & Transactions
│   ├── hr/             # Employees & Roles
│   ├── inventory/      # Stock Management
│   ├── master/         # Master Data (Items, Partners)
│   ├── platform/       # System Settings
│   ├── purchasing/     # POs & Suppliers
│   ├── sales/          # Orders & Quotes
│   ├── support/        # Help Desk
│   └── tools/          # Mini-Apps
├── storage/            # IndexedDB Adapters
├── types/              # TypeScript Interfaces
├── index.html          # Entry Point
└── index.tsx           # React Mount
```

---

## 🚦 Usage

### Prerequisites
*   A modern web browser (Chrome, Edge, Safari, Firefox).
*   Any local static file server.

### Running Locally
1.  **Clone** or download this repository.
2.  **Serve** the root directory.
    *   *Python*: `python3 -m http.server 8000`
    *   *Node*: `npx serve .`
    *   *VS Code*: Right-click `index.html` -> "Open with Live Server"
3.  **Access**: Open `http://localhost:8000`

### Demo Credentials
The system comes pre-seeded with mock users for different roles:

| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `super@nexuserp.io` | `password` | Platform Console |
| **Tenant Admin** | `alice@techflow.com` | `password` | Client & Company |
| **Sales Rep** | `bob@techflow.com` | `password` | Sales Module Only |

*Tip: Use the "Auto-fill" button on the login screen to quickly switch contexts.*

---

## ⌨️ Shortcuts

| Key | Action |
| :--- | :--- |
| `Cmd + K` / `Ctrl + K` | Open Command Palette |
| `Esc` | Close Modals / Menus |

---

## 🧩 Customization

*   **Feature Flags**: Toggle modules on/off in `data/mockHierarchy.ts`.
*   **Navigation**: Modify the sidebar menu in `config/menuConfig.ts`.
*   **Mock Data**: Edit seed files in `data/` to change the initial state.

---
*Built for the future of enterprise software.*