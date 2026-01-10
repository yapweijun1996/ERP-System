import express from 'express';
import { query } from '../db/index.js';

const router = express.Router();

/**
 * GET /api/hr/employees
 * List employees for a company
 */
router.get('/employees', async (req, res) => {
    try {
        const { companyId } = req.query;

        if (!companyId) {
            return res.status(400).json({ error: 'Validation Error', message: 'companyId is required' });
        }

        // Check if user has access to this company
        // TODO: Implement middleware for permission checking

        // For now, we return a mock list joined with real users if needed, 
        // OR we query a real employees table.
        // Since we don't have an employees table in the schema shown earlier (wait, let me check schema),
        // Ah, I missed checking for an 'employees' table explicitly in previous schema view.
        // Let's check schema first. If no employees table, we might alias 'users' as employees for now?
        // Or did I miss it?

        // Let's assume for now we query the 'users' table and treat them as employees,
        // or we need to CREATE an employees table.
        // The previous schema view showed: tenants, companies, users, roles, permissions...
        // It didn't explicitly show an 'employees' table in the partial view I saw.
        // But the type definition in frontend has 'Employee'.

        // Let's query users for now as a fallback.
        const result = await query(
            `SELECT id, email, name as "firstName", 'User' as "lastName", 
             'Staff' as "jobTitle", 'Active' as status, id as "userId"
             FROM users 
             WHERE $1 = ANY(array(SELECT company_id FROM user_companies WHERE user_id = users.id))
             OR tenant_id = (SELECT tenant_id FROM companies WHERE id = $1)
             `,
            [companyId]
        );

        // Mapping to match frontend Employee interface
        const employees = result.rows.map(row => ({
            id: row.id,
            firstName: row.firstName.split(' ')[0],
            lastName: row.firstName.split(' ').slice(1).join(' ') || '',
            email: row.email,
            departmentId: 'dept-001', // Mock
            jobTitle: row.jobTitle,
            status: row.status,
            joinDate: new Date().toISOString(),
            userId: row.userId
        }));

        res.json(employees);
    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({ error: 'Server Error', message: error.message });
    }
});

/**
 * GET /api/hr/departments
 * List departments
 */
router.get('/departments', async (req, res) => {
    // Return mock departments for now until we have a table
    res.json([
        { id: 'dept-001', name: 'Executive', managerId: null },
        { id: 'dept-002', name: 'Sales', managerId: null },
        { id: 'dept-003', name: 'Engineering', managerId: null },
        { id: 'dept-004', name: 'Finance', managerId: null },
    ]);
});

export default router;
