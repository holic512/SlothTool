const test = require('node:test');
const assert = require('node:assert/strict');
const {normalizeModels, toEndpointList, normalizeRequestHeaders, buildUrl} = require('../lib/modes-client');

test('toEndpointList supports string and deduplicates arrays', () => {
    assert.deepEqual(toEndpointList('/models', ['/v1/models']), ['/models']);
    assert.deepEqual(
        toEndpointList(['/v1/models', ' /models ', '/models', ''], ['/fallback']),
        ['/v1/models', '/models']
    );
});

test('normalizeModels supports OpenAI-style payload', () => {
    const payload = {
        object: 'list',
        data: [
            {id: 'gpt-4o'},
            {id: 'gpt-4.1-mini'}
        ]
    };

    const output = normalizeModels(payload, 'openrouter', null);
    assert.equal(output.length, 2);
    assert.equal(output[0].id, 'gpt-4o');
    assert.equal(output[1].id, 'gpt-4.1-mini');
});

test('normalizeModels supports grouped payload', () => {
    const payload = {
        data: {
            code: ['gpt-5.3-codex', 'gpt-5-codex-mini'],
            chat: [{id: 'gpt-4.1'}]
        }
    };

    const output = normalizeModels(payload, 'openrouter', null);
    assert.equal(output.length, 3);

    const codex = output.find(item => item.id === 'gpt-5.3-codex');
    const chat = output.find(item => item.id === 'gpt-4.1');
    assert.equal(codex.modeId, 'code');
    assert.equal(chat.modeId, 'chat');
});

test('normalizeRequestHeaders strips symbol keys and stringifies values', () => {
    const symbolKey = Symbol('type');
    const headers = {
        Authorization: 'Bearer token',
        'X-Retry': 3,
        [symbolKey]: 'bad-key'
    };

    const output = normalizeRequestHeaders(headers);
    assert.deepEqual(output, {
        Authorization: 'Bearer token',
        'X-Retry': '3'
    });
});

test('buildUrl deduplicates repeated version path', () => {
    const url = buildUrl('https://docs.newapi.ai/v1', '/v1/models', null);
    assert.equal(url, 'https://docs.newapi.ai/v1/models');
});

test('buildUrl keeps endpoint version when base has no version', () => {
    const url = buildUrl('https://docs.newapi.ai', '/v1/models', null);
    assert.equal(url, 'https://docs.newapi.ai/v1/models');
});
