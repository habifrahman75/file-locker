'use strict';

const fs = require('fs');
const db = require('./db');

/**
 * Deletes physical files and database records for expired files.
 * Updates status of download-limit-reached files.
 */
function runCleanup() {
  let removed = 0;
  let updated = 0;

  try {
    // 1. Remove expired files (both file + DB record)
    const expired = db.getExpiredFiles();
    for (const file of expired) {
      try {
        if (fs.existsSync(file.file_path)) {
          fs.unlinkSync(file.file_path);
          removed++;
        }
      } catch (e) {
        console.error(`[Cleanup] Could not delete file ${file.file_path}:`, e.message);
      }
      db.deleteFile(file.file_id);
    }

    // 2. Mark download-limit-reached files (keep DB record for reference)
    const limitReached = db.getLimitReachedFiles();
    for (const file of limitReached) {
      db.updateStatus(file.file_id, 'limit_reached');
      updated++;
    }

    if (removed > 0 || updated > 0) {
      console.log(`[Cleanup] Removed ${removed} expired file(s), updated ${updated} limit-reached record(s).`);
    }
  } catch (err) {
    console.error('[Cleanup] Error during cleanup:', err.message);
  }
}

/**
 * Starts the automatic cleanup service.
 * Runs immediately on startup then every 30 minutes.
 */
function startCleanup() {
  // Run once immediately on startup
  runCleanup();

  // Schedule recurring cleanup every 30 minutes
  const INTERVAL_MS = 30 * 60 * 1000;
  setInterval(runCleanup, INTERVAL_MS);

  console.log('[Cleanup] Service started — runs every 30 minutes.');
}

module.exports = { startCleanup, runCleanup };
