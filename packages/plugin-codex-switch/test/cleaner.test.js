const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {collectCleanupPlan, summarizePlan, executePlan} = require('../lib/cleaner');

test('collectCleanupPlan returns expected cache targets', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-switch-cleaner-'));
    const tmpDir = path.join(root, 'tmp');
    const snapDir = path.join(root, 'shell_snapshots');
    fs.mkdirSync(tmpDir, {recursive: true});
    fs.mkdirSync(snapDir, {recursive: true});
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'aaa', 'utf8');
    fs.writeFileSync(path.join(snapDir, 'b.txt'), 'bbbb', 'utf8');

    const plan = collectCleanupPlan(root, 7);
    const summary = summarizePlan(plan);

    assert.equal(plan.length, 2);
    assert.equal(summary.fileCount, 2);
    assert.equal(summary.totalBytes, 7);

    const run = executePlan(plan, true);
    assert.equal(run.fileCount, 2);

    fs.rmSync(root, {recursive: true, force: true});
});
