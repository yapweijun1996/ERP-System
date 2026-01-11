import express from 'express';
import { query } from '../db/index.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/sales/documents
 * Get sales documents
 */
router.get('/documents', requirePermission('SALES_VIEW'), async (req, res) => {
    try {
        const { status, docType } = req.query;
        const companyId = req.query?.companyId || req.auth?.companyDbId;
        if (!companyId) {
            return res.status(400).json({ error: 'Validation Error', message: 'companyId is required' });
        }

        let sql = `SELECT id, tenant_id, company_id, doc_type, doc_number, customer_id, customer_name,
                      doc_date, due_date, status, currency, subtotal, tax_amount, total_amount,
                      created_at, created_by
               FROM sales_documents
               WHERE deleted_at IS NULL`;
        const params = [];
        let paramCount = 0;

        if (companyId) {
            paramCount++;
            sql += ` AND company_id = $${paramCount}`;
            params.push(companyId);
        }

        if (status) {
            paramCount++;
            sql += ` AND status = $${paramCount}`;
            params.push(status);
        }

        if (docType) {
            paramCount++;
            sql += ` AND doc_type = $${paramCount}`;
            params.push(docType);
        }

        sql += ' ORDER BY doc_date DESC, created_at DESC LIMIT 100';

        const result = await query(sql, params);

        res.json({
            documents: result.rows,
            total: result.rowCount
        });
    } catch (error) {
        console.error('Get sales documents error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch sales documents'
        });
    }
});

/**
 * GET /api/sales/documents/:id
 * Get sales document by ID with lines
 */
router.get('/documents/:id', requirePermission('SALES_VIEW'), async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.query?.companyId || req.auth?.companyDbId;
        if (!companyId) {
            return res.status(400).json({ error: 'Validation Error', message: 'companyId is required' });
        }

        // Get document header
        const docResult = await query(
            `SELECT * FROM sales_documents WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
            [id, companyId]
        );

        if (docResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Sales document not found'
            });
        }

        // Get document lines
        const linesResult = await query(
            `SELECT * FROM sales_document_lines WHERE document_id = $1 ORDER BY line_number`,
            [id]
        );

        res.json({
            ...docResult.rows[0],
            lines: linesResult.rows
        });
    } catch (error) {
        console.error('Get sales document error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch sales document'
        });
    }
});

/**
 * GET /api/sales/customers
 * Get customers
 */
router.get('/customers', requirePermission('SALES_VIEW'), async (req, res) => {
    try {
        const companyId = req.query?.companyId || req.auth?.companyDbId;
        if (!companyId) {
            return res.status(400).json({ error: 'Validation Error', message: 'companyId is required' });
        }

        let sql = `SELECT id, tenant_id, company_id, code, name, email, phone, country, 
                      credit_limit, payment_terms, status, created_at
               FROM customers
               WHERE deleted_at IS NULL`;
        const params = [];

        sql += ' AND company_id = $1';
        params.push(companyId);

        sql += ' ORDER BY name';

        const result = await query(sql, params);

        res.json({
            customers: result.rows,
            total: result.rowCount
        });
    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch customers'
        });
    }
});

export default router;
