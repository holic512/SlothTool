const fs = require('fs');
const path = require('path');

function listEntriesRecursive(rootPath) {
    if (!fs.existsSync(rootPath)) {
        return [];
    }

    const result = [];
    const stack = [rootPath];

    while (stack.length > 0) {
        const current = stack.pop();
        const stat = fs.lstatSync(current);
        result.push({path: current, isDirectory: stat.isDirectory(), size: stat.isFile() ? stat.size : 0, mtimeMs: stat.mtimeMs});

        if (stat.isDirectory()) {
            const children = fs.readdirSync(current).map(name => path.join(current, name));
            for (const child of children) {
                stack.push(child);
            }
        }
    }

    return result;
}

function isSafeTarget(codexHome, target) {
    const relative = path.relative(codexHome, target);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function removePath(targetPath) {
    if (!fs.existsSync(targetPath)) {
        return;
    }

    fs.rmSync(targetPath, {recursive: true, force: true});
}

function collectCleanupPlan(codexHome, sessionsDays) {
    const plan = [];
    const targets = ['tmp', 'shell_snapshots'];

    for (const item of targets) {
        const targetPath = path.join(codexHome, item);
        if (fs.existsSync(targetPath) && isSafeTarget(codexHome, targetPath)) {
            plan.push({
                kind: item,
                path: targetPath,
                entries: listEntriesRecursive(targetPath)
            });
        }
    }

    const sessionsPath = path.join(codexHome, 'sessions');
    if (fs.existsSync(sessionsPath) && isSafeTarget(codexHome, sessionsPath)) {
        const expireMs = Date.now() - Number(sessionsDays || 7) * 24 * 60 * 60 * 1000;
        const children = fs.readdirSync(sessionsPath).map(name => path.join(sessionsPath, name));
        const stale = children.filter(item => {
            try {
                const stat = fs.statSync(item);
                return stat.mtimeMs < expireMs;
            } catch (error) {
                return false;
            }
        });

        if (stale.length > 0) {
            const entries = [];
            for (const item of stale) {
                entries.push(...listEntriesRecursive(item));
            }
            plan.push({
                kind: 'sessions',
                path: sessionsPath,
                staleItems: stale,
                entries
            });
        }
    }

    return plan;
}

function summarizePlan(plan) {
    const files = plan.flatMap(item => item.entries || []).filter(item => !item.isDirectory);
    return {
        fileCount: files.length,
        totalBytes: files.reduce((sum, item) => sum + item.size, 0)
    };
}

function executePlan(plan, dryRun) {
    const deleted = [];

    if (!dryRun) {
        for (const item of plan) {
            if (item.kind === 'sessions' && Array.isArray(item.staleItems)) {
                for (const stale of item.staleItems) {
                    removePath(stale);
                    deleted.push(stale);
                }
            } else {
                removePath(item.path);
                deleted.push(item.path);
            }
        }
    }

    return {
        deleted,
        ...summarizePlan(plan)
    };
}

module.exports = {
    collectCleanupPlan,
    executePlan,
    summarizePlan
};
