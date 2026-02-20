const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {getCodexHomeCandidates} = require('../lib/config-paths');

test('getCodexHomeCandidates includes CODEX_HOME first when set', () => {
    const prev = process.env.CODEX_HOME;
    process.env.CODEX_HOME = '/tmp/custom-codex-home';

    const candidates = getCodexHomeCandidates();

    assert.equal(candidates[0], path.resolve('/tmp/custom-codex-home'));
    assert.ok(candidates.includes(path.resolve(path.join(process.env.HOME || '', '.config', 'codex'))));

    if (prev === undefined) {
        delete process.env.CODEX_HOME;
    } else {
        process.env.CODEX_HOME = prev;
    }
});
