import express from 'express';
import { query } from '../db/index.js';

const router = express.Router();

/**
 * GET /api/inventory/items
 * Get all inventory items with current stock level
 */
router.get('/items', async (req, res) => {
    try {
        const { companyId } = req.query;

        if (!companyId) {
            return res.status(400).json({ error: 'companyId is required' });
        }

        // Fetch items directly from the items table
        // For 'stock', we currently default to 0 as we haven't implemented stock aggregation logic yet
        // In a real system, you'd join with inventory_transactions or a stock_summary table
        const sql = `
            SELECT i.id, i.code, i.name, i.description, 
                   i.unit_of_measure as unit, i.selling_price as price, 
                   i.status, 
                   COALESCE((
                       SELECT SUM(quantity) 
                       FROM inventory_transactions 
                       WHERE item_id = i.id
                   ), 0) as stock
            FROM items i
            WHERE i.company_id = $1 AND i.deleted_at IS NULL
            ORDER BY i.name ASC
        `;

        const result = await query(sql, [companyId]);

        // Transform to match frontend InventoryItem interface roughly
        const items = result.rows.map(row => ({
            id: row.id,
            sku: row.code,
            name: row.name,
            description: row.description,
            unit: row.unit,
            price: parseFloat(row.price),
            stock: parseFloat(row.stock),
            status: row.status || 'Active',
            category: 'General' // Default for now
        }));

        res.json({ items });
    } catch (error) {
        console.error('Get inventory items error:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to fetch inventory items' });
    }
});

/**
 * GET /api/inventory/warehouses
 */
router.get('/warehouses', async (req, res) => {
    try {
        const { companyId } = req.query;
        if (!companyId) return res.status(400).json({ error: 'companyId is required' });

        const sql = `SELECT id, code, name, location FROM warehouses WHERE company_id = $1 AND deleted_at IS NULL`;
        const result = await query(sql, [companyId]);

        res.json({ warehouses: result.rows });
    } catch (error) {
        console.error('Get warehouses error:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to fetch warehouses' });
    }
});


/**
 * POST /api/inventory/adjust
 * Create an inventory adjustment (transaction)
 */
router.post('/adjust', async (req, res) => {
    try {
        const { companyId, itemId, quantity, type, reference, notes, warehouseId } = req.body;
        // Basic validation
        if (!companyId || !itemId || !quantity || !type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // We need tenant_id. Usually this comes from req.user or active context.
        // For now, we will fetch it from the item or company to be safe, or assume passed/inferred.
        // Let's look up the item to get tenant_id and verify existence.
        const itemResult = await query('SELECT tenant_id FROM items WHERE id = $1', [itemId]);
        if (itemResult.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        const tenantId = itemResult.rows[0].tenant_id;

        // Generate ID
        const id = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const sql = `
            INSERT INTO inventory_transactions 
            (id, tenant_id, company_id, warehouse_id, item_id, transaction_type, quantity, reference_type, reference_id, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'system')
            RETURNING *
        `;

        // type: 'ADJUST_IN', 'ADJUST_OUT', 'SCRAP', 'COUNT'
        // If 'ADJUST_OUT' or 'SCRAP', quantity should be negative if not already
        let finalQty = parseFloat(quantity);
        if ((type === 'ADJUST_OUT' || type === 'SCRAP') && finalQty > 0) {
            finalQty = -finalQty;
        }

        const values = [
            id,
            tenantId,
            companyId,
            warehouseId || null,
            itemId,
            type,
            finalQty,
            'MANUAL_ADJUST',
            reference || 'N/A',
            notes || '',
        ];

        const result = await query(sql, values);

        res.status(201).json({ transaction: result.rows[0], message: 'Adjustment posted successfully' });
    } catch (error) {
        console.error('Post inventory adjustment error:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to post adjustment' });
    }
});

export default router;
