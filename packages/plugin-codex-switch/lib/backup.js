const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {ensureDir, getBackupDir} = require('./config-paths');

function makeBackupId() {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const rand = crypto.randomBytes(4).toString('hex');
    return `${ts}-${rand}`;
}

function listBackups() {
    const dir = getBackupDir();
    if (!fs.existsSync(dir)) {
        return [];
    }

    return fs.readdirSync(dir)
        .filter(name => name.endsWith('.toml'))
        .map(name => {
            const filePath = path.join(dir, name);
            const stat = fs.statSync(filePath);
            return {
                id: name.replace(/\.toml$/, ''),
                path: filePath,
                size: stat.size,
                mtime: stat.mtime.toISOString()
            };
        })
        .sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
}

function createBackup(configPath, maxFiles = 30) {
    ensureDir(getBackupDir());
    const backupId = makeBackupId();
    const backupPath = path.join(getBackupDir(), `${backupId}.toml`);
    fs.copyFileSync(configPath, backupPath);
    pruneBackups(maxFiles);

    return {
        id: backupId,
        path: backupPath
    };
}

function pruneBackups(maxFiles = 30) {
    const backups = listBackups();
    if (backups.length <= maxFiles) {
        return;
    }

    const removeItems = backups.slice(maxFiles);
    for (const item of removeItems) {
        fs.unlinkSync(item.path);
    }
}

function restoreBackup(configPath, backupId) {
    const backupPath = path.join(getBackupDir(), `${backupId}.toml`);
    if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup not found: ${backupId}`);
    }

    const tempPath = `${configPath}.rollback-${Date.now()}.tmp`;
    fs.copyFileSync(backupPath, tempPath);
    fs.renameSync(tempPath, configPath);

    return {
        id: backupId,
        path: backupPath
    };
}

module.exports = {
    listBackups,
    createBackup,
    restoreBackup
};
