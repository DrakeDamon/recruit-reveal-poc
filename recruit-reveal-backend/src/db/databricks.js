const { DBSQLClient } = require('@databricks/sql');
require('dotenv').config();

const HOST = process.env.DATABRICKS_HOST || process.env.databricks_host;
const HTTP_PATH = process.env.DATABRICKS_HTTP_PATH;
const TOKEN = process.env.DATABRICKS_TOKEN;
const CAT = process.env.DATABRICKS_CATALOG || 'recruit_reveal_databricks';
const SCH = process.env.DATABRICKS_SCHEMA || 'default';

if (!HOST || !HTTP_PATH || !TOKEN) {
  console.warn('[databricks.js] Missing required env vars: DATABRICKS_HOST/HTTP_PATH/TOKEN');
}

/** Open a session, set catalog/schema, run fn(session), then clean up. */
async function withSql(fn) {
  const client = new DBSQLClient();
  const conn = await client.connect({ host: HOST, path: HTTP_PATH, token: TOKEN });
  const session = await conn.openSession();
  try {
    const catOp = await session.executeStatement(`USE CATALOG ${CAT}`, { runAsync: false });
    await catOp.fetchAll();
    await catOp.close();
    
    const schOp = await session.executeStatement(`USE SCHEMA ${SCH}`, { runAsync: false });
    await schOp.fetchAll();
    await schOp.close();
    return await fn(session);
  } finally {
    await session.close();
    await conn.close();
    await client.close();
  }
}

/** Execute SQL and return an array of objects with column names. */
async function query(sqlText) {
  return withSql(async (session) => {
    const op = await session.executeStatement(sqlText, { runAsync: false });
    const schema = await op.getSchema();
    const cols = (schema?.columns || []).map(c => c.name || c.columnName);
    const rows = await op.fetchAll();
    await op.close();
    if (!cols.length) return rows; // fallback (arrays)
    return rows.map(r => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
  });
}

/** Simple connection test. */
async function testConnection() {
  try {
    const rows = await query(`SELECT current_catalog() AS catalog, current_schema() AS schema`);
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  withSql,
  query,
  testConnection,
  CAT,
  SCH,
};