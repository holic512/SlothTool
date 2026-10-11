/**
 * @file task-state.js
 * @project SlothTool
 * @module SlothVault task lifecycle
 * @description Pure task transitions, separate input/execution clocks and verified deployment outcomes.
 * @logic Attribute events to one task, preserve layer measurements, pause clocks for prompts and require runtime evidence for application success.
 * @dependencies None
 * @index_tags slothvault,tasks,progress,verification
 * @author holic512
 */
const TERMINAL = new Set(['completed', 'unchanged', 'cancelled', 'failed', 'partial']);
export function createTask(id, action, now = Date.now(), versions = {}) {
    return {id, action, state: 'checking', startedAt: now, activeSince: now, executionMs: 0, waitingMs: 0,
        phaseMs: 0, phaseStartedAt: now, lastProgressAt: now, lastHeartbeatAt: null, logs: [], layers: {}, ...versions};
}
export function taskTimes(task, now = Date.now()) {
    const end = task.finishedAt ?? now;
    return {executionMs: task.executionMs + (task.activeSince != null ? end - task.activeSince : 0),
        waitingMs: task.waitingMs + (task.waitingSince != null ? end - task.waitingSince : 0),
        phaseMs: task.phaseMs + (task.phaseStartedAt != null ? end - task.phaseStartedAt : 0)};
}
function pause(task, now) {
    return {...task, ...taskTimes(task, now), activeSince: null, waitingSince: null, phaseStartedAt: null};
}
export function taskEvent(task, event, now = Date.now()) {
    if (!task || TERMINAL.has(task.state)) return task;
    if (event.type === 'prompt') return {...pause(task, now), state: 'waiting', waitingSince: now, prompt: event};
    if (event.type === 'answer') return {...pause(task, now), state: 'running', activeSince: now,
        phaseStartedAt: task.progress?.status === 'completed' ? null : now, prompt: null, cancelRequested: event.cancelled === true};
    if (event.type === 'progress') {
        if (event.heartbeat) return {...task, lastHeartbeatAt: now};
        const changed = task.progress?.phase !== event.phase;
        const progress = {...event};
        const previous = event.subject ? task.layers[event.subject] : task.progress;
        const advanced = changed || !previous || ['phase', 'subject', 'current', 'total', 'status', 'message', 'stageIndex'].some(key => previous[key] !== event[key]);
        // A per-layer completion does not complete the command's overall phase.
        const completed = event.status === 'completed' && !event.subject;
        return {...task, state: task.state === 'waiting' ? 'waiting' : event.phase === 'verify' ? 'verifying' : 'running',
            progress, lastProgressAt: advanced ? now : task.lastProgressAt, phaseMs: changed ? 0 : taskTimes(task, now).phaseMs,
            phaseStartedAt: task.state === 'waiting' || completed ? null : now,
            layers: changed ? (event.subject ? {[event.subject]: {...event}} : {}) : event.subject ? {...task.layers, [event.subject]: {...event}} : task.layers};
    }
    if (event.type === 'log') return {...task, logs: [...task.logs, event.message]};
    if (event.type === 'preview') return {...task, preview: event.data, beforeVersion: event.data?.currentVersion,
        targetVersion: event.data?.targetVersion};
    if (event.type === 'snapshot') return {...task, snapshot: event.data, currentVersion: event.data?.appVersion};
    if (event.type === 'error') return {...task, error: event.message, errorCode: event.code};
    if (event.type === 'done') return {...task, done: event};
    return task;
}
const version = value => typeof value === 'string' ? value.replace(/^v/u, '') : null;
export function finishTask(task, result = {}, now = Date.now()) {
    let state = result.code === 130 ? 'cancelled'
        : task.error || result.code != null && result.code !== 0 || result.status === 'error' || result.outcome === 'failed' ? 'failed'
            : result.outcome === 'cancelled' || task.cancelRequested ? 'cancelled'
            : result.status === 'partial' || result.warnings?.length ? 'partial'
                : result.status === 'latest' || result.outcome === 'unchanged' ? 'unchanged' : 'completed';
    let error = task.error || result.reason;
    if (task.action === 'update' && !['cancelled', 'failed'].includes(state)) {
        const snapshot = task.snapshot;
        const application = snapshot?.containers?.find(item => item.service === 'slothvault');
        const matches = state === 'unchanged' ? Boolean(snapshot?.appVersion) : task.targetVersion && version(snapshot?.appVersion) === version(task.targetVersion);
        const running = application?.state === 'running';
        const healthy = !application?.health || application.health === 'healthy';
        if (!matches || !running || !healthy || result.verified === false || snapshot?.appVersionSource === 'image-tag' || task.preview?.image && snapshot?.runtimeImage !== task.preview.image || snapshot?.errors?.some(item => ['docker', 'snapshot'].includes(item.scope))) {
            state = 'partial';
            error = 'VERSION_UNVERIFIED';
        }
    }
    return {...pause(task, now), state, finishedAt: now, error, result, currentVersion: task.currentVersion ?? result.currentVersion};
}
