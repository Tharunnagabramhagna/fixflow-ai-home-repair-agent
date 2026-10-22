#!/usr/bin/env node

/**
 * FixFlow — Production Verified Backup Engine
 * Creates a crash-safe, WAL-checkpointed SQLite backup and executes
 * rigorous integrity, foreign key, and snapshot equality checks.
 */

const fs = require('fs');
const path = require('path');

// Portably resolve better-sqlite3 from environment or backend/node_modules
let Database;
try {
  Database = require('better-sqlite3');
} catch (e1) {
  try {
    Database = require(path.resolve(__dirname, '..', 'backend', 'node_modules', 'better-sqlite3'));
  } catch (e2) {
    try {
      Database = require(path.resolve(__dirname, '..', '..', 'backend', 'node_modules', 'better-sqlite3'));
    } catch (e3) {
      console.error('[ERROR] Cannot find better-sqlite3 module. Ensure dependencies are installed in backend/.');
      process.exit(1);
    }
  }
}

const REQUIRED_TABLES = ['appliances', 'repair_cases', 'repair_events', 'warranty_documents'];

async function createVerifiedBackup() {
  const projectRoot = path.resolve(__dirname, '..');
  const defaultSourceDb = path.resolve(projectRoot, 'database', 'data', 'fixflow.db');
  const sourceDbPath = process.env.DATABASE_PATH || defaultSourceDb;
  const backupsDir = path.resolve(projectRoot, 'database', 'backups');

  console.log('====================================================');
  console.log('   FixFlow — Production Verified Backup Engine      ');
  console.log('====================================================');
  console.log(`Source Database: ${sourceDbPath}`);
  console.log(`Backups Directory: ${backupsDir}`);

  if (!fs.existsSync(sourceDbPath)) {
    console.error(`[FAIL] Source database does not exist at: ${sourceDbPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const finalBackupPath = path.resolve(backupsDir, `fixflow-backup-${timestamp}.db`);
  const stagingBackupPath = path.resolve(backupsDir, `fixflow-backup-${timestamp}-staging.db`);

  let sourceDb = null;
  let backupDb = null;
  const verificationReport = {
    sourceSnapshot: {},
    walCheckpoint: false,
    backupOperation: false,
    fileExists: false,
    integrityCheck: false,
    foreignKeyCheck: false,
    requiredTablesExist: false,
    tableCountsMatch: false,
    allPassed: false,
  };

  try {
    // 1. Open Source Database & Checkpoint WAL safely
    sourceDb = new Database(sourceDbPath);
    sourceDb.pragma('foreign_keys = ON');

    console.log('\n[1/5] Checkpointing WAL into primary database file...');
    try {
      const checkpoint = sourceDb.pragma('wal_checkpoint(TRUNCATE)');
      console.log(`      WAL Checkpoint Result: ${JSON.stringify(checkpoint)}`);
      verificationReport.walCheckpoint = true;
    } catch (err) {
      console.error(`[WARN] WAL checkpoint error: ${err.message}`);
    }

    // 2. Capture Source Snapshot Counts
    console.log('\n[2/5] Capturing source database record snapshot...');
    for (const table of REQUIRED_TABLES) {
      try {
        const row = sourceDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
        verificationReport.sourceSnapshot[table] = row.count;
        console.log(`      ${table}: ${row.count} records`);
      } catch (err) {
        console.error(`[FAIL] Missing required source table: ${table} (${err.message})`);
        verificationReport.sourceSnapshot[table] = -1;
      }
    }

    // 3. Execute SQLite Native Backup API
    console.log('\n[3/5] Executing native SQLite online backup...');
    await sourceDb.backup(stagingBackupPath);
    verificationReport.backupOperation = true;
    console.log(`      Staged backup created: ${path.basename(stagingBackupPath)}`);

    // Close source handle to ensure clean state
    sourceDb.close();
    sourceDb = null;

    // 4. Verify Backup File Exists & Opens
    console.log('\n[4/5] Verifying backup database integrity and constraints...');
    if (fs.existsSync(stagingBackupPath) && fs.statSync(stagingBackupPath).size > 0) {
      verificationReport.fileExists = true;
      console.log(`      [PASS] Backup file exists (${fs.statSync(stagingBackupPath).size} bytes).`);
    } else {
      console.error('      [FAIL] Backup file missing or empty.');
    }

    backupDb = new Database(stagingBackupPath, { readonly: true });

    // Check PRAGMA integrity_check
    const integrityRows = backupDb.pragma('integrity_check');
    const integrityOk = Array.isArray(integrityRows) &&
      integrityRows.length === 1 &&
      integrityRows[0].integrity_check === 'ok';

    if (integrityOk) {
      verificationReport.integrityCheck = true;
      console.log('      [PASS] PRAGMA integrity_check = ok');
    } else {
      console.error(`      [FAIL] PRAGMA integrity_check returned unexpected: ${JSON.stringify(integrityRows)}`);
    }

    // Check PRAGMA foreign_key_check (CRITICAL REQUIREMENT)
    const fkViolations = backupDb.pragma('foreign_key_check');
    if (Array.isArray(fkViolations) && fkViolations.length === 0) {
      verificationReport.foreignKeyCheck = true;
      console.log('      [PASS] PRAGMA foreign_key_check = 0 violations');
    } else {
      console.error(`      [FAIL] PRAGMA foreign_key_check found ${fkViolations.length} violations:`, fkViolations);
    }

    // Check Required Tables Exist
    const masterTables = backupDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
    const missingTables = REQUIRED_TABLES.filter(t => !masterTables.includes(t));
    if (missingTables.length === 0) {
      verificationReport.requiredTablesExist = true;
      console.log('      [PASS] All required tables exist in backup.');
    } else {
      console.error(`      [FAIL] Missing required tables in backup: ${missingTables.join(', ')}`);
    }

    // Check Exact Table Counts Match Source Snapshot
    console.log('\n[5/5] Comparing backup table counts against source snapshot:');
    let countsMatched = true;
    for (const table of REQUIRED_TABLES) {
      const backupCount = (backupDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get()).count;
      const sourceCount = verificationReport.sourceSnapshot[table];
      const match = (backupCount === sourceCount);
      console.log(`      - ${table}: Source=${sourceCount} | Backup=${backupCount} -> ${match ? 'MATCH' : 'MISMATCH'}`);
      if (!match) countsMatched = false;
    }
    verificationReport.tableCountsMatch = countsMatched;

    // Evaluate Final Verification Condition
    verificationReport.allPassed = (
      verificationReport.backupOperation &&
      verificationReport.fileExists &&
      verificationReport.integrityCheck &&
      verificationReport.foreignKeyCheck && // Required: included in final boolean
      verificationReport.requiredTablesExist &&
      verificationReport.tableCountsMatch
    );

    // Close backup handle before final rename
    backupDb.close();
    backupDb = null;

    console.log('\n====================================================');
    if (verificationReport.allPassed) {
      fs.renameSync(stagingBackupPath, finalBackupPath);
      console.log('[FINAL RESULT] PASS — VERIFIED BACKUP CREATED');
      console.log(`Verified Backup Location: ${finalBackupPath}`);
      console.log('Integrity: OK | Foreign Keys: 0 violations | Record Counts: 100% matched');
      console.log('====================================================\n');
      process.exit(0);
    } else {
      const failedPath = path.resolve(backupsDir, `fixflow-backup-${timestamp}-unverified.db`);
      if (fs.existsSync(stagingBackupPath)) {
        fs.renameSync(stagingBackupPath, failedPath);
      }
      console.error('[FINAL RESULT] FAIL — BACKUP VERIFICATION FAILED');
      console.error(`Unverified file retained for diagnostic inspection: ${failedPath}`);
      console.error('One or more verification checks failed.');
      console.log('====================================================\n');
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n[FATAL ERROR] Backup execution failed: ${error.message}`);
    if (sourceDb) {
      try { sourceDb.close(); } catch {}
    }
    if (backupDb) {
      try { backupDb.close(); } catch {}
    }
    process.exit(1);
  }
}

if (require.main === module) {
  createVerifiedBackup();
}

module.exports = { createVerifiedBackup };
