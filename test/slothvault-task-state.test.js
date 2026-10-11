import test from 'node:test';
import assert from 'node:assert/strict';
import {createTask, taskTimes, taskEvent, finishTask} from '../plugins/slothvault/lib/task-state.js';
import {progressLines, detailWindow} from '../plugins/slothvault/lib/terminal-ui.js';

test('a minute of input wait freezes execution and completed phase clocks', () => {
    let task = createTask(1, 'update', 0);
    task = taskEvent(task, {type: 'progress', phase: 'release', status: 'running'}, 0);
    task = taskEvent(task, {type: 'progress', phase: 'release', status: 'completed'}, 2000);
    task = taskEvent(task, {type: 'prompt', kind: 'confirm'}, 2500);
    assert.deepEqual(taskTimes(task, 62500), {executionMs: 2500, waitingMs: 60000, phaseMs: 2000});
    assert.equal(task.state, 'waiting');
    assert.doesNotMatch(progressLines(task, 62500).join('\n'), /操作完成|没有新业务进度/u);
    task = taskEvent(task, {type: 'answer'}, 62500);
    task = taskEvent(task, {type: 'progress', phase: 'pull', status: 'running'}, 63000);
    assert.deepEqual(taskTimes(task, 65000), {executionMs: 5000, waitingMs: 60000, phaseMs: 2000});
});

test('heartbeats preserve inactivity and layer transitions discard stale measurements', () => {
    let task = createTask(1, 'update', 0);
    task = taskEvent(task, {type: 'progress', phase: 'pull', subject: 'abc', current: 10, total: 20, unit: 'bytes'}, 1000);
    task = taskEvent(task, {type: 'progress', phase: 'pull', subject: 'abc', current: 10, total: 20, unit: 'bytes'}, 33000);
    assert.equal(task.lastProgressAt, 1000);
    task = taskEvent(task, {type: 'progress', heartbeat: true}, 35000);
    assert.equal(task.lastProgressAt, 1000);
    assert.equal(task.lastHeartbeatAt, 35000);
    assert.match(progressLines(task, 35000).join('\n'), /34|running|运行/u);
    task = taskEvent(task, {type: 'progress', phase: 'pull', subject: 'def', message: 'extracting'}, 36000);
    assert.doesNotMatch(progressLines(task, 36000).join('\n'), /%/u);
    assert.equal(task.layers.abc.current, 10);
    task = taskEvent(task, {type: 'progress', phase: 'pull', status: 'completed'}, 37000);
    assert.equal(task.progress.subject, undefined);
    assert.equal(taskTimes(task, 60000).phaseMs, taskTimes(task, 37000).phaseMs);
    task = taskEvent(task, {type: 'progress', phase: 'recreate'}, 60000);
    assert.deepEqual(task.layers, {});
});

const snapshot = {appVersion: 'v2.5.20', runtimeImage: 'holic512/slothvault:v2.5.20',
    containers: [{service: 'slothvault', state: 'running', health: 'healthy'}], errors: []};
function updateTask(state = snapshot) {
    return taskEvent(taskEvent(createTask(1, 'update', 0), {type: 'preview', data: {currentVersion: 'v2.3.1', targetVersion: 'v2.5.20'}}, 10),
        {type: 'snapshot', data: state}, 20);
}
test('application success requires runtime evidence, independent from the process success code', () => {
    assert.equal(finishTask(updateTask(), {code: 0, verified: true}, 100).state, 'completed');
    for (const bad of [{...snapshot, appVersion: 'v2.3.1'}, {...snapshot, containers: []},
        {...snapshot, containers: [{service: 'slothvault', state: 'exited'}]},
        {...snapshot, containers: [{service: 'slothvault', state: 'running', health: 'unhealthy'}]},
        {...snapshot, appVersionSource: 'image-tag'}, {...snapshot, errors: [{scope: 'snapshot'}]}, null]) {
        assert.equal(finishTask(updateTask(bad), {code: 0}, 100).state, 'partial');
    }
    assert.equal(finishTask(updateTask(), {code: 1, outcome: 'updated'}, 100).state, 'failed');
    assert.equal(finishTask({...updateTask(), cancelRequested: true}, {code: 1}, 100).state, 'failed');
    assert.equal(finishTask(updateTask(), {code: 130}, 100).state, 'cancelled');
    assert.equal(finishTask(updateTask(), {code: 0, outcome: 'unchanged'}, 100).state, 'unchanged');
    assert.equal(finishTask(updateTask(), {code: 0, outcome: 'cancelled'}, 100).state, 'cancelled');
    const done = finishTask(updateTask(), {code: 0}, 100);
    assert.equal(taskEvent(done, {type: 'snapshot', data: null}, 500), done);
    assert.deepEqual(taskTimes(done, 100), taskTimes(done, 90000));
});

test('fixed status stays outside the scroll window for hundreds of lines', () => {
    const logs = Array.from({length: 500}, (_, n) => `output ${n}`), pinned = ['Waiting for confirmation', 'y / n'];
    const start = detailWindow(logs, pinned, 0, 80, 18);
    const end = detailWindow(logs, pinned, 10000, 80, 18);
    assert.deepEqual(start.pinned, end.pinned);
    assert.ok(end.lines.includes('output 499'));
    assert.deepEqual(detailWindow(logs, pinned, 0, 80, 18, true), end);
});
