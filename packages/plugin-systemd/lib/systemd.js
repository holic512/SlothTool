const {spawn, spawnSync} = require('child_process');
const {t} = require('./i18n');

const SAFE_SERVICE_RE = /^[A-Za-z0-9@._:-]+$/;

function validateServiceName(name) {
    return typeof name === 'string' && name.length > 0 && SAFE_SERVICE_RE.test(name);
}

function isLinux() {
    return process.platform === 'linux';
}

function isSystemctlAvailable() {
    const result = spawnSync('systemctl', ['--version'], {encoding: 'utf8'});
    return result.status === 0;
}

function checkEnvironment() {
    if (!isLinux()) {
        return {ok: false, message: t('notLinux')};
    }
    if (!isSystemctlAvailable()) {
        return {ok: false, message: t('systemctlNotFound')};
    }
    return {ok: true};
}

function buildResult(action, service, result) {
    return {
        time: new Date().toISOString(),
        action,
        service,
        result: result.success ? 'success' : 'failed',
        code: result.code ?? 1,
        message: result.message || ''
    };
}

function runCommand(command, args, options = {}) {
    const streamOutput = !!options.streamOutput;
    return new Promise((resolve) => {
        const child = spawn(command, args, {stdio: ['ignore', 'pipe', 'pipe']});
        let stdout = '';
        let stderr = '';

        if (child.stdout) {
            child.stdout.on('data', (data) => {
                const text = data.toString();
                stdout += text;
                if (streamOutput) {
                    process.stdout.write(text);
                }
            });
        }

        if (child.stderr) {
            child.stderr.on('data', (data) => {
                const text = data.toString();
                stderr += text;
                if (streamOutput) {
                    process.stderr.write(text);
                }
            });
        }

        child.on('close', (code) => {
            const exitCode = code ?? 1;
            resolve({
                success: exitCode === 0,
                code: exitCode,
                stdout,
                stderr,
                message: stderr || stdout,
                streamed: streamOutput
            });
        });

        child.on('error', (error) => {
            resolve({
                success: false,
                code: 1,
                stdout,
                stderr,
                message: error.message,
                streamed: streamOutput
            });
        });
    });
}

function detectPermissionError(text) {
    if (!text) return false;
    const lowered = text.toLowerCase();
    return lowered.includes('permission denied') ||
        lowered.includes('access denied') ||
        lowered.includes('authentication is required');
}

async function listServices(options = {}) {
    const args = ['list-units', '--type=service', '--no-pager'];
    if (options.all) {
        args.push('--all');
    }
    if (options.state) {
        args.push(`--state=${options.state}`);
    }
    if (options.pattern) {
        args.push(`--pattern=${options.pattern}`);
    }
    if (options.forInteractive) {
        args.push('--no-legend');
    }
    const result = await runCommand('systemctl', args);
    if (options.forInteractive && result.success) {
        const lines = result.stdout.split('\n').filter(line => line.trim());
        const services = lines.map(line => {
            const parts = line.split(/\s+/);
            const unit = parts[0];
            const load = parts[1];
            const active = parts[2];
            const sub = parts[3];
            const description = parts.slice(4).join(' ');
            return {unit, load, active, sub, description};
        });
        return {result, services};
    }
    return {result, services: []};
}

function statusService(service) {
    return runCommand('systemctl', ['status', service, '--no-pager'], {streamOutput: true});
}

function startService(service) {
    return runCommand('systemctl', ['start', service]);
}

function stopService(service) {
    return runCommand('systemctl', ['stop', service]);
}

function restartService(service) {
    return runCommand('systemctl', ['restart', service]);
}

function enableService(service) {
    return runCommand('systemctl', ['enable', service]);
}

function disableService(service) {
    return runCommand('systemctl', ['disable', service]);
}

function showLogs(service, options = {}) {
    const args = ['-u', service, '--no-pager'];
    if (options.lines) {
        args.push('-n', String(options.lines));
    }
    if (options.follow) {
        args.push('-f');
    }
    if (options.since) {
        args.push('--since', options.since);
    }
    return runCommand('journalctl', args, {streamOutput: !!options.follow});
}

module.exports = {
    SAFE_SERVICE_RE,
    validateServiceName,
    isSystemctlAvailable,
    checkEnvironment,
    buildResult,
    detectPermissionError,
    listServices,
    statusService,
    startService,
    stopService,
    restartService,
    enableService,
    disableService,
    showLogs
};
