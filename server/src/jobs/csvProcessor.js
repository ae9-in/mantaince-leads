import { parse } from 'csv-parse/sync';
import { query } from '../config/db.js';
import crypto from 'crypto';
import { invalidateOnLeadChange, cacheSet } from '../services/cache.js';
import { broadcastToAll } from '../services/assignmentBroadcaster.js';

const BATCH_SIZE = 500; // Rows per bulk INSERT — balances memory and round-trips

/**
 * CSV formula injection sanitizer
 */
const sanitizeFormula = (val) => {
    if (val === undefined || val === null) return '';
    const str = val.toString().trim();
    if (/^[=+\-@\t\r]/.test(str)) return ''; // Neutralize CSV injection
    return str;
};

/**
 * Coerces phone format — keeps only digits and leading +
 */
const sanitizePhone = (phone) => {
    if (!phone) return '';
    return phone.toString().replace(/[^\d+]/g, '');
};

/**
 * Build a multi-row VALUES SQL and params for bulk INSERT.
 */
function buildBulkInsertSql(rows, verticalId, subVerticalId, defaultAssignedTo, uploadedBy, batchId) {
    const COLS_PER_ROW = 12;
    const colNames = [
        'id', 'vertical_id', 'sub_vertical_id', 'assigned_to',
        'uploaded_by', 'name', 'phone', 'business_name',
        'data', 'csv_batch_id', 'lead_type', 'status'
    ];

    const valuePlaceholders = [];
    const params = [];
    let p = 1;

    for (const row of rows) {
        const placeholders = [];
        for (let i = 0; i < COLS_PER_ROW; i++) {
            placeholders.push(`$${p++}`);
        }
        valuePlaceholders.push(`(${placeholders.join(', ')})`);
        params.push(
            crypto.randomUUID(),
            verticalId,
            subVerticalId || null,
            row.assignedTo || defaultAssignedTo || null,
            uploadedBy,
            row.name,
            row.phone,
            row.businessName,
            JSON.stringify(row.data),
            batchId,
            row.leadType || 'CALL',
            row.status || 'new'
        );
    }

    const sql = `
        INSERT INTO cost_conversions (${colNames.join(', ')})
        VALUES ${valuePlaceholders.join(', ')}
        ON CONFLICT DO NOTHING
    `;
    return { sql, params };
}

/**
 * Queue processor function.
 */
export const processCsvJob = async (job) => {
    const { batchId, fileBufferBase64, verticalId, uploadedBy, assignedTo, subVerticalId, leadType = 'CALL' } = job.data;

    let totalRows = 0;
    let successCount = 0;
    let duplicateCount = 0;
    const errors = [];
    const validLeads = [];

    // Mark job as in-progress
    await query(
        'UPDATE csv_upload_logs SET status = $1, processing_started_at = NOW() WHERE id = $2',
        ['processing', batchId]
    );

    // Initial cache state
    await cacheSet(`csv_progress:${batchId}`, {
        id: batchId,
        uploaded_by: uploadedBy,
        vertical_id: verticalId,
        status: 'processing',
        total_rows: 0,
        success_count: 0,
        failed_count: 0,
        duplicate_count: 0,
        errors: []
    }, 3600);

    try {
        const buffer = Buffer.from(fileBufferBase64, 'base64');
        const rows   = parse(buffer, { columns: true, trim: true, skip_empty_lines: true });

        totalRows = rows.length;
        await query('UPDATE csv_upload_logs SET total_rows = $1 WHERE id = $2', [totalRows, batchId]);

        if (totalRows === 0) {
            await query(
                "UPDATE csv_upload_logs SET status = 'done', processing_finished_at = NOW() WHERE id = $1",
                [batchId]
            );
            await cacheSet(`csv_progress:${batchId}`, {
                id: batchId,
                uploaded_by: uploadedBy,
                vertical_id: verticalId,
                status: 'done',
                total_rows: 0,
                success_count: 0,
                failed_count: 0,
                duplicate_count: 0,
                errors: []
            }, 3600);
            return;
        }

        await cacheSet(`csv_progress:${batchId}`, {
            id: batchId,
            uploaded_by: uploadedBy,
            vertical_id: verticalId,
            status: 'processing',
            total_rows: totalRows,
            success_count: 0,
            failed_count: 0,
            duplicate_count: 0,
            errors: []
        }, 3600);

        const configsRes = await query(
            'SELECT field_key, csv_header, label FROM field_configs WHERE vertical_id = $1',
            [verticalId]
        );
        const configs = configsRes.rows;

        const agentsRes = await query(
            'SELECT id, name FROM users WHERE $1 = ANY(vertical_access)',
            [verticalId]
        );
        const agentMap = new Map(agentsRes.rows.map(a => [a.name.toLowerCase().trim(), a.id]));

        const csvPhones = [];
        for (const rawRow of rows) {
            const row = {};
            for (const k of Object.keys(rawRow)) {
                const key = k.toLowerCase().trim();
                if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
                    row[key] = rawRow[k];
                }
            }
            const rawPhone = sanitizePhone(row['number'] || row['phone'] || row['mobile'] || row['contact no'] || row['contact'] || '');
            if (rawPhone) {
                csvPhones.push(rawPhone);
            }
        }
        const uniqueCsvPhones = [...new Set(csvPhones)];

        let existingPhones = [];
        if (uniqueCsvPhones.length > 0) {
            const existingRes = await query(
                `SELECT phone FROM cost_conversions WHERE vertical_id = $1 AND is_deleted = false AND phone = ANY($2)`,
                [verticalId, uniqueCsvPhones]
            );
            existingPhones = existingRes.rows.map(l => sanitizePhone(l.phone));
        }
        const phoneSet = new Set(existingPhones);

        let rowNum = 0;
        for (const rawRow of rows) {
            rowNum++;

            const row = {};
            for (const k of Object.keys(rawRow)) {
                const key = k.toLowerCase().trim();
                if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
                    row[key] = sanitizeFormula(rawRow[k]);
                }
            }

            const rawPhone    = sanitizePhone(row['contact no'] || row['contact'] || row['number'] || row['phone'] || row['mobile'] || '');
            const rawName     = row['business/person/shop/company name'] || row['name'] || '';
            const rawBusiness = row['business/person/shop/company name'] || row['business'] || row['business name'] || '';

            if (!rawPhone) {
                errors.push({ row: rowNum, reason: 'Missing phone number' });
                if (rowNum % 100 === 0 || rowNum === totalRows) {
                    await cacheSet(`csv_progress:${batchId}`, {
                        id: batchId,
                        uploaded_by: uploadedBy,
                        vertical_id: verticalId,
                        status: 'processing',
                        total_rows: totalRows,
                        success_count: 0,
                        failed_count: errors.length,
                        duplicate_count: duplicateCount,
                        errors: errors
                    }, 3600);
                }
                continue;
            }

            if (phoneSet.has(rawPhone)) {
                duplicateCount++;
                errors.push({ row: rowNum, reason: `Duplicate phone number: ${rawPhone}` });
                if (rowNum % 100 === 0 || rowNum === totalRows) {
                    await cacheSet(`csv_progress:${batchId}`, {
                        id: batchId,
                        uploaded_by: uploadedBy,
                        vertical_id: verticalId,
                        status: 'processing',
                        total_rows: totalRows,
                        success_count: 0,
                        failed_count: errors.length,
                        duplicate_count: duplicateCount,
                        errors: errors
                    }, 3600);
                }
                continue;
            }

            const dataMap = {};
            // New template field mappings
            dataMap['date'] = row['date'] || '';
            dataMap['businessType'] = row['business type'] || row['businesstype'] || '';
            dataMap['area'] = row['area'] || '';
            dataMap['city'] = row['city'] || '';
            dataMap['pointOfContact'] = row['point of contact (name & number not mandatory for products)'] || row['point of contact'] || row['pointofcontact'] || '';
            dataMap['remarks'] = row['remarks'] || '';
            dataMap['recording'] = row['recording'] || '';
            dataMap['requirement'] = row['requirement(if any)'] || row['requirement (if any)'] || row['requirement'] || '';
            dataMap['requireFollowUp'] = row['require follow up (yes/no)'] || row['require follow up'] || row['requirefollowup'] || '';
            dataMap['followUpDate'] = row['follow up date'] || row['followupdate'] || '';
            dataMap['followUpRemarks'] = row['follow up remarks'] || row['followupremarks'] || '';
            dataMap['notesToCosTeam'] = row['notes to cos team (if any)'] || row['notes to cos team'] || row['notestocteam'] || '';
            // Legacy / backward compat fields
            dataMap['nameBusiness'] = row['name business'] || row['namebusiness'] || '';
            dataMap['deliveredLocation'] = row['delivered location (google maps location)'] || row['delivered location'] || row['delivered'] || row['location'] || '';
            dataMap['deliveredLink'] = row['delivered link'] || row['link'] || '';
            const empSpokenRaw = row['employee name'] || row['employee spoken'] || row['employee'] || row['spoken'] || '';
            dataMap['employeeSpoken'] = empSpokenRaw;
            dataMap['convertedStatus'] = row['converted status'] || row['converted'] || '';

            const empSpokenName = empSpokenRaw.toLowerCase().trim();
            const rowAssignedTo = agentMap.get(empSpokenName) || null;

            const rawLeadType = row['lead type'] || row['type'] || leadType;
            let leadTypeVal = leadType;
            if (leadType === 'CALL') {
                if (rawLeadType.toLowerCase().includes('field')) {
                    leadTypeVal = 'FIELD';
                }
            }

            const rawStatus = (row['status'] || 'new').toLowerCase().trim();
            let statusVal = 'new';
            if (['new', 'contacted', 'converted', 'lost'].includes(rawStatus)) {
                statusVal = rawStatus;
            }

            for (const cfg of configs) {
                const header = (cfg.csv_header || cfg.label).toLowerCase().trim();
                const fieldKey = cfg.field_key;
                if (header !== '__proto__' && header !== 'constructor' && header !== 'prototype' &&
                    fieldKey !== '__proto__' && fieldKey !== 'constructor' && fieldKey !== 'prototype') {
                    if (row[header] !== undefined) {
                        dataMap[fieldKey] = row[header];
                    } else if (dataMap[fieldKey] === undefined) {
                        dataMap[fieldKey] = '';
                    }
                }
            }

            validLeads.push({
                name: rawName, phone: rawPhone,
                businessName: rawBusiness, data: dataMap,
                assignedTo: rowAssignedTo,
                leadType: leadTypeVal,
                status: statusVal
            });

            phoneSet.add(rawPhone);

            if (rowNum % 100 === 0 || rowNum === totalRows) {
                await cacheSet(`csv_progress:${batchId}`, {
                    id: batchId,
                    uploaded_by: uploadedBy,
                    vertical_id: verticalId,
                    status: 'processing',
                    total_rows: totalRows,
                    success_count: 0,
                    failed_count: errors.length,
                    duplicate_count: duplicateCount,
                    errors: errors
                }, 3600);
            }
        }

        // Bulk INSERT
        for (let i = 0; i < validLeads.length; i += BATCH_SIZE) {
            const chunk = validLeads.slice(i, i + BATCH_SIZE);
            try {
                const { sql, params } = buildBulkInsertSql(
                    chunk, verticalId, subVerticalId, assignedTo, uploadedBy, batchId
                );
                const result = await query(sql, params);
                successCount += result.rowCount;
            } catch (chunkErr) {
                const chunkStart = i + 1;
                const chunkEnd   = Math.min(i + BATCH_SIZE, validLeads.length);
                errors.push({ row: `${chunkStart}-${chunkEnd}`, reason: chunkErr.message });
            }

            const progress = Math.round(((i + chunk.length) / validLeads.length) * 100);
            await job.progress(progress);

            await cacheSet(`csv_progress:${batchId}`, {
                id: batchId,
                uploaded_by: uploadedBy,
                vertical_id: verticalId,
                status: 'processing',
                total_rows: totalRows,
                success_count: successCount,
                failed_count: errors.length,
                duplicate_count: duplicateCount,
                errors: errors
            }, 3600);
        }

        await query(`
            UPDATE csv_upload_logs
            SET status = 'done', success_count = $1, failed_count = $2,
                duplicate_count = $3, errors = $4, processing_finished_at = NOW()
            WHERE id = $5
        `, [successCount, errors.length, duplicateCount, JSON.stringify(errors), batchId]);

        await cacheSet(`csv_progress:${batchId}`, {
            id: batchId,
            uploaded_by: uploadedBy,
            vertical_id: verticalId,
            status: 'done',
            total_rows: totalRows,
            success_count: successCount,
            failed_count: errors.length,
            duplicate_count: duplicateCount,
            errors: errors
        }, 3600);

        invalidateOnLeadChange(verticalId, null).catch(() => {});

        try {
            broadcastToAll({ type: 'COST_CONVERSION_MUTATED', verticalId, action: 'csv_upload', batchId });
        } catch (broadcastErr) {
            console.error('[CSV Processor] SSE broadcast failed:', broadcastErr.message);
        }

        await job.progress(100);

    } catch (error) {
        console.error('❌ CSV Job Processing Failed:', error.message);
        const failedErrors = errors && errors.length > 0 ? errors : [{ row: 0, reason: error.message }];
        await query(
            'UPDATE csv_upload_logs SET status = $1, errors = $2 WHERE id = $3',
            ['failed', JSON.stringify(failedErrors), batchId]
        );
        await cacheSet(`csv_progress:${batchId}`, {
            id: batchId,
            uploaded_by: uploadedBy,
            vertical_id: verticalId,
            status: 'failed',
            total_rows: totalRows || 0,
            success_count: successCount || 0,
            failed_count: failedErrors.length,
            duplicate_count: duplicateCount || 0,
            errors: failedErrors
        }, 3600).catch(() => {});
        throw error;
    }
};

export default processCsvJob;
