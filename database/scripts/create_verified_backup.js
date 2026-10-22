#!/usr/bin/env node

/**
 * FixFlow — Production Verified Backup Engine (database/scripts proxy)
 * Delegates to scripts/create_verified_backup.js
 */

const { createVerifiedBackup } = require('../../scripts/create_verified_backup.js');

if (require.main === module) {
  createVerifiedBackup();
}

module.exports = { createVerifiedBackup };
