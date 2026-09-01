'use strict';

/**
 * Database service using sql.js (pure JavaScript SQLite — no native build tools needed).
 *
 * sql.js holds the database in memory and we persist it to disk by writing the
 * binary buffer on every mutating operation (insert / update / delete).
 * This is safe for a local single-server application.
 */

require('dotenv').config();
const initSqlJs = require('sql.js');
const path = require('path');
const fs   = require('fs');

const DB_PATH = path.resolve(process.env.DB_PATH || path.join(__dirname, '..', 'data', 'filelocker.db'));
const DB_DIR  = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// sql.js initialisation — we export a promise that resolves to the DB module.
// All callers await db.ready before using queries.

let _db = null;  // The in-memory sql.js Database instance

async function init() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(buf);
  } else {
    _db = new SQL.Database();
  }

  // Create schema
  _db.run(`
    CREATE TABLE IF NOT EXISTS files (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id        TEXT    UNIQUE NOT NULL,
      original_name  TEXT    NOT NULL,
      stored_name    TEXT    NOT NULL,
      file_path      TEXT    NOT NULL,
      file_size      INTEGER NOT NULL DEFAULT 0,
      mime_type      TEXT    NOT NULL DEFAULT '',
      password_hash  TEXT    NOT NULL,
      owner_token    TEXT    NOT NULL,
      created_at     TEXT    NOT NULL,
      expires_at     TEXT    NOT NULL,
      download_count INTEGER NOT NULL DEFAULT 0,
      max_downloads  INTEGER NOT NULL DEFAULT 0,
      status         TEXT    NOT NULL DEFAULT 'active'
    )
  `);

  save();
  return _db;
}

/** Persist the in-memory database to disk. */
function save() {
  if (!_db) return;
  try {
    const buf = Buffer.from(_db.export());
    fs.writeFileSync(DB_PATH, buf);
  } catch (err) {
    console.error('[DB] Save error:', err.message);
  }
}

/** Execute a SELECT and return all rows as plain objects. */
function query(sql, params = []) {
  if (!_db) throw new Error('Database not initialised');
  const stmt = _db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/** Execute a SELECT that returns at most one row. */
function queryOne(sql, params = []) {
  return query(sql, params)[0] || null;
}

/** Execute a mutating statement (INSERT / UPDATE / DELETE). */
function run(sql, params = []) {
  if (!_db) throw new Error('Database not initialised');
  _db.run(sql, params);
  save();
}

// ─── Public API ───────────────────────────────────────────────────────────────

function insertFile(data) {
  run(`
    INSERT INTO files
      (file_id, original_name, stored_name, file_path, file_size, mime_type,
       password_hash, owner_token, created_at, expires_at, download_count, max_downloads, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.file_id, data.original_name, data.stored_name, data.file_path,
      data.file_size, data.mime_type, data.password_hash, data.owner_token,
      data.created_at, data.expires_at, data.download_count, data.max_downloads, data.status,
    ]
  );
}

function getFileById(fileId) {
  return queryOne('SELECT * FROM files WHERE file_id = ?', [fileId]);
}

function incrementDownloadCount(fileId) {
  run('UPDATE files SET download_count = download_count + 1 WHERE file_id = ?', [fileId]);
}

function updateStatus(fileId, status) {
  run('UPDATE files SET status = ? WHERE file_id = ?', [status, fileId]);
}

function deleteFile(fileId) {
  run('DELETE FROM files WHERE file_id = ?', [fileId]);
}

function getExpiredFiles() {
  return query(
    `SELECT * FROM files WHERE expires_at < ? AND status NOT IN ('deleted','cleaned')`,
    [new Date().toISOString()]
  );
}

function getLimitReachedFiles() {
  return query(
    `SELECT * FROM files WHERE max_downloads > 0 AND download_count >= max_downloads AND status = 'active'`
  );
}

// ─── Initialisation Promise ───────────────────────────────────────────────────
// We export the ready promise so server.js can await it before listening.

const ready = init().catch(err => {
  console.error('[DB] Fatal: could not initialise database:', err.message);
  process.exit(1);
});

module.exports = {
  ready,
  insertFile,
  getFileById,
  incrementDownloadCount,
  updateStatus,
  deleteFile,
  getExpiredFiles,
  getLimitReachedFiles,
};
