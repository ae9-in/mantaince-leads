const CHUNK_SIZE = 1000;

export class BulkInsertError extends Error {
  constructor(message, chunkIndex, cause) {
    super(message);
    this.name       = 'BulkInsertError';
    this.chunkIndex = chunkIndex;
    this.cause      = cause;
  }
}

/**
 * bulkInsert — insert many rows in a single parameterized query
 *
 * @param {object}   db          - pg Pool/Client or direct query function
 * @param {string}   table       - table name
 * @param {string[]} columns     - column names in order
 * @param {any[][]}  rows        - array of value arrays, matching columns order
 * @param {object}   [opts]
 * @param {string}   [opts.onConflict]  - e.g. 'ON CONFLICT (email) DO NOTHING'
 * @param {boolean}  [opts.returning]   - include RETURNING * (default true)
 * @returns {Promise<object[]>}  inserted rows
 */
export async function bulkInsert(db, table, columns, rows, opts = {}) {
  if (!rows.length) return [];

  const { onConflict = '', returning = true } = opts;
  const colCount = columns.length;
  const allInserted = [];

  const queryFn = typeof db.query === 'function' ? db.query.bind(db) : db;

  // Chunk to avoid exceeding PostgreSQL's 65535 parameter limit
  for (let chunkIdx = 0; chunkIdx < rows.length; chunkIdx += CHUNK_SIZE) {
    const chunk = rows.slice(chunkIdx, chunkIdx + CHUNK_SIZE);

    // Build: ($1,$2,$3), ($4,$5,$6), ...
    const valuePlaceholders = chunk.map((_, rowIdx) =>
      `(${columns.map((_, colIdx) => `$${rowIdx * colCount + colIdx + 1}`).join(',')})`
    ).join(',');

    const flatValues = chunk.flat();

    const sql = [
      `INSERT INTO ${table} (${columns.join(',')})`,
      `VALUES ${valuePlaceholders}`,
      onConflict,
      returning ? 'RETURNING *' : '',
    ].filter(Boolean).join(' ');

    try {
      const { rows: inserted } = await queryFn(sql, flatValues);
      allInserted.push(...inserted);
    } catch (err) {
      throw new BulkInsertError(
        `Bulk insert failed at chunk ${chunkIdx / CHUNK_SIZE}`,
        chunkIdx / CHUNK_SIZE,
        err
      );
    }
  }

  return allInserted;
}
