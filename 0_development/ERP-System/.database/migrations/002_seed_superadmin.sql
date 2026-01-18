-- ============================================
-- Seed Data for Superadmin DB (Minimal)
-- Creates ONLY the superadmin account + platform role.
-- No demo tenant/company/sample data.
-- ============================================

-- Platform Administrator role (system-wide)
INSERT INTO roles (id, tenant_id, name, description, is_system_role)
VALUES ('role-platform-admin', NULL, 'Platform Administrator', 'Full system access', true)
ON CONFLICT (id) DO NOTHING;

-- Assign ALL permissions to Platform Administrator
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-platform-admin', id FROM permissions
ON CONFLICT DO NOTHING;

-- Superadmin user (default password: "password")
-- Hash: $2a$10$6rF/9Fuqml6QhpgSBSfjU.cik7Lm6iXR/8VDGnGaHLDWvyos/BxXy
INSERT INTO users (id, tenant_id, username, email, password_hash, name, status, default_company_id)
VALUES (
  'user-super-001',
  NULL,
  'superadmin',
  'super@nexuserp.io',
  '$2a$10$6rF/9Fuqml6QhpgSBSfjU.cik7Lm6iXR/8VDGnGaHLDWvyos/BxXy',
  'Super Admin',
  'Active',
  NULL
)
ON CONFLICT (username) DO NOTHING;

-- Map superadmin -> platform role
INSERT INTO user_roles (user_id, role_id)
VALUES ('user-super-001', 'role-platform-admin')
ON CONFLICT DO NOTHING;

DO $$
BEGIN
    RAISE NOTICE '✅ Superadmin seed applied (minimal)';
    RAISE NOTICE '  - User: superadmin';
    RAISE NOTICE '  - Role: Platform Administrator';
END $$;

