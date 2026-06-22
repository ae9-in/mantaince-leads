import fs from 'fs';
import { parse } from 'csv-parse';
import mongoose from 'mongoose';
import Lead from '../models/lead.js';
import FieldConfig from '../models/fieldConfig.js';
import CsvUploadLog from '../models/csvUploadLog.js';
import AuditLog from '../models/auditLog.js';

const BASE_DYNAMIC_HEADER_MAP = new Map([
  ['name business', { key: 'nameBusiness', fieldType: 'text' }],
  ['namebusiness', { key: 'nameBusiness', fieldType: 'text' }],
  ['date', { key: 'date', fieldType: 'date' }],
  ['employee spoken', { key: 'employeeSpoken', fieldType: 'text' }],
  ['employeespoken', { key: 'employeeSpoken', fieldType: 'text' }],
  ['converted status', { key: 'convertedStatus', fieldType: 'text' }],
  ['convertedstatus', { key: 'convertedStatus', fieldType: 'text' }],
  ['delivered location', { key: 'deliveredLocation', fieldType: 'text' }],
  ['deliveredlocation', { key: 'deliveredLocation', fieldType: 'text' }],
  ['delivered location (google maps location)', { key: 'deliveredLocation', fieldType: 'text' }],
  ['deliveredlocation(googlemapslocation)', { key: 'deliveredLocation', fieldType: 'text' }],
  ['delivered link', { key: 'deliveredLink', fieldType: 'url' }],
  ['deliveredlink', { key: 'deliveredLink', fieldType: 'url' }]
]);

// Helper to sanitize cell values against Formula Injection
export const sanitizeCell = (value) => {
  if (typeof value === 'string' && value.length > 0) {
    const trimmed = value.trim();
    const firstChar = trimmed.charAt(0);
    if (['=', '+', '-', '@'].includes(firstChar)) {
      // Strip leading formula triggers
      return trimmed.replace(/^[=\+\-@]+/, '');
    }
    return trimmed;
  }
  return value;
};

// Helper to coerce string values based on FieldConfig type
export const coerceValue = (value, fieldType) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const strVal = String(value).trim();

  if (fieldType === 'boolean') {
    const trueValues = ['true', 'yes', 'y', '1', 'checked'];
    const falseValues = ['false', 'no', 'n', '0', 'unchecked'];
    if (trueValues.includes(strVal.toLowerCase())) return true;
    if (falseValues.includes(strVal.toLowerCase())) return false;
    return false;
  }

  if (fieldType === 'number') {
    const num = Number(strVal);
    return isNaN(num) ? undefined : num;
  }

  if (fieldType === 'date') {
    const date = new Date(strVal);
    return isNaN(date.getTime()) ? undefined : date;
  }

  return strVal;
};

class CsvQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  enqueue(job) {
    this.queue.push(job);
    this.processNext();
  }

  async processNext() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const job = this.queue.shift();

    try {
      await this.processJob(job);
    } catch (err) {
      console.error('CSV Job processing failed:', err);
      try {
        await CsvUploadLog.findByIdAndUpdate(job.logId, {
          status: 'failed',
          errors: [{ row: 0, reason: `Fatal error: ${err.message}` }]
        });
      } catch (logErr) {
        console.error('Failed to update CSV upload log status:', logErr);
      }
    } finally {
      this.processing = false;
      this.processNext();
    }
  }

  async processJob(job) {
    const { filePath, verticalId, uploadedBy, logId } = job;
    
    // 1. Fetch all field configs for this vertical (to map headers and validate fields)
    const fieldConfigs = await FieldConfig.find({ verticalId });

    // Build header lookup map
    // Key: lowercase normalized header, Value: FieldConfig document
    const configMap = new Map();
    fieldConfigs.forEach(config => {
      if (config.csvHeader) {
        configMap.set(config.csvHeader.trim().toLowerCase(), config);
      }
      configMap.set(config.label.trim().toLowerCase(), config);
      configMap.set(config.fieldKey.trim().toLowerCase(), config);
    });

    const log = await CsvUploadLog.findById(logId);
    if (!log) {
      throw new Error(`Log record not found for ID: ${logId}`);
    }

    const errors = [];
    const validRows = [];
    let rowCount = 0;
    let successCount = 0;
    let failedCount = 0;

    // Use a transaction session if running in replica set mode
    let session = null;
    let useTransaction = false;
    try {
      session = await mongoose.startSession();
      // Test if replica set is available by starting a transaction
      session.startTransaction();
      useTransaction = true;
    } catch (e) {
      // Replica set not enabled, fallback to non-transaction inserts
      if (session) session.endSession();
      session = null;
    }

    const parser = fs.createReadStream(filePath).pipe(
      parse({
        columns: true, // Use the first line as headers
        skip_empty_lines: true,
        trim: true,
      })
    );

    // Track phones in the current batch to avoid importing duplicate phones in the same upload
    const batchPhones = new Set();

    try {
      for await (const record of parser) {
        rowCount++;
        
        // Find matching columns from record keys
        const recordKeys = Object.keys(record);
        
        let name = '';
        let phone = '';
        let businessName = '';
        let status = 'new';
        const customData = {};

        // Track validation errors for this row
        let rowHasError = false;
        let errorReason = '';

        // Extract base fields
        for (const key of recordKeys) {
          const normKey = key.trim().toLowerCase();
          const rawVal = sanitizeCell(record[key]);

          if (normKey === 'name') {
            name = rawVal;
          } else if (normKey === 'number' || normKey === 'phone') {
            phone = rawVal;
          } else if (normKey === 'business' || normKey === 'business name' || normKey === 'businessname') {
            businessName = rawVal;
          } else if (normKey === 'status') {
            const rawStatus = rawVal.toLowerCase().trim();
            if (['new', 'contacted', 'converted', 'lost'].includes(rawStatus)) {
              status = rawStatus;
            }
          } else if (BASE_DYNAMIC_HEADER_MAP.has(normKey)) {
            const baseField = BASE_DYNAMIC_HEADER_MAP.get(normKey);
            const coerced = coerceValue(rawVal, baseField.fieldType);
            if (coerced !== undefined) {
              customData[baseField.key] = coerced;
            }
          } else {
            // Check if it matches a custom field config
            const config = configMap.get(normKey);
            if (config) {
              const coerced = coerceValue(rawVal, config.fieldType);
              
              if (config.isRequired && (coerced === undefined || coerced === null || coerced === '')) {
                rowHasError = true;
                errorReason = `Field "${config.label}" is required.`;
              } else if (coerced !== undefined) {
                customData[config.fieldKey] = coerced;
              }
            }
          }
        }

        // Validate phone number formatting / presence (compulsory)
        if (!phone) {
          rowHasError = true;
          errorReason = 'Required field Phone Number is missing or empty.';
        }

        // Check for deduplication within the vertical
        if (!rowHasError && phone) {
          if (batchPhones.has(phone)) {
            rowHasError = true;
            errorReason = `Duplicate phone number "${phone}" within this upload batch.`;
          } else {
            // Check in Database
            const dbQuery = { verticalId, phone };
            const existingLead = session 
              ? await Lead.findOne(dbQuery).session(session) 
              : await Lead.findOne(dbQuery);

            if (existingLead) {
              rowHasError = true;
              errorReason = `Lead with phone number "${phone}" already exists in this vertical.`;
            } else {
              batchPhones.add(phone);
            }
          }
        }

        if (rowHasError) {
          failedCount++;
          errors.push({ row: rowCount, reason: errorReason });
          continue;
        }

        // Build lead document structure
        validRows.push({
          verticalId,
          assignedTo: null, // default unassigned
          uploadedBy,
          name,
          phone: phone || undefined,
          businessName: businessName || undefined,
          data: customData,
          status,
          source: 'csv_upload',
          csvBatchId: logId
        });

        successCount++;
      }

      // Bulk insert rows
      if (validRows.length > 0) {
        if (useTransaction && session) {
          await Lead.insertMany(validRows, { session, ordered: false });
        } else {
          await Lead.insertMany(validRows, { ordered: false });
        }
      }

      // Update upload logs
      log.status = 'done';
      log.totalRows = rowCount;
      log.successCount = successCount;
      log.failedCount = failedCount;
      log.errors = errors;

      if (useTransaction && session) {
        await log.save({ session });
        
        // Write audit log
        await AuditLog.create([{
          actorId: uploadedBy,
          action: 'csv.bulk_import',
          targetCollection: 'leads',
          targetId: logId,
          diff: { successCount, failedCount, totalRows: rowCount },
        }], { session });

        await session.commitTransaction();
      } else {
        await log.save();

        await AuditLog.create({
          actorId: uploadedBy,
          action: 'csv.bulk_import',
          targetCollection: 'leads',
          targetId: logId,
          diff: { successCount, failedCount, totalRows: rowCount },
        });
      }

    } catch (error) {
      if (useTransaction && session) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
      // Clean up uploaded file
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`Error deleting temp file ${filePath}:`, err.message);
      }
    }
  }
}

export const csvQueue = new CsvQueue();
export default csvQueue;
