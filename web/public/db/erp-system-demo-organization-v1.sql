-- Demo-only fictional organization masters. Existing records are never updated.
-- The adapter applies this separate pack only after the shared migrations.
INSERT INTO hr_business_unit (master_fn, company_fn, code, name)
SELECT 'M1', 'C-SG', fixture.code, fixture.name
FROM (VALUES ('DEMO-COMMERCIAL', 'Commercial'), ('DEMO-OPERATIONS', 'Operations'),
             ('DEMO-CORPORATE', 'Corporate Services')) AS fixture(code, name)
WHERE EXISTS (SELECT 1 FROM company WHERE master_fn='M1' AND company_fn='C-SG')
ON CONFLICT (master_fn, company_fn, code) DO NOTHING;

INSERT INTO hr_position (master_fn, company_fn, code, name)
SELECT 'M1', 'C-SG', fixture.code, fixture.name
FROM (VALUES ('DEMO-MANAGER', 'Manager'), ('DEMO-EXECUTIVE', 'Executive'),
             ('DEMO-SPECIALIST', 'Specialist'), ('DEMO-ANALYST', 'Analyst'),
             ('DEMO-COORDINATOR', 'Coordinator'), ('DEMO-ASSOCIATE', 'Associate')) AS fixture(code, name)
WHERE EXISTS (SELECT 1 FROM company WHERE master_fn='M1' AND company_fn='C-SG')
ON CONFLICT (master_fn, company_fn, code) DO NOTHING;
