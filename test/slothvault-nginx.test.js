import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDeploymentArguments, NGINX_MENU_ACTIONS, nginxStatusLines} from '../plugins/slothvault/lib/manager-tui.js';

test('Nginx menu exposes discovery, selection, status and one site update', () => {
    assert.deepEqual(NGINX_MENU_ACTIONS, ['nginx-discover', 'nginx-select', 'nginx-status', 'nginx', 'nginx-update', 'https', 'renew', 'back']);
    assert.deepEqual(buildDeploymentArguments('nginx-update', {root: '/data/vault', nginxMode: 'docker', nginxContainer: 'proxy', nginxConfig: '/custom/nginx.conf', nginxSite: '/custom/vault.conf', nginxServerName: 'vault.example.com'}), ['--action', 'nginx-update', '--root', '/data/vault', '--nginx-mode', 'docker', '--nginx-container', 'proxy', '--nginx-config', '/custom/nginx.conf', '--nginx-site', '/custom/vault.conf', '--nginx-server-name', 'vault.example.com']);
    assert.deepEqual(buildDeploymentArguments('update', {nginxSite: '/ignored.conf'}), ['--action', 'update', '--root', '/data/slothvault']);
});
test('status renders loaded files, mount mapping and actual transfer limits', () => {
    const lines = nginxStatusLines({state: 'configured', instances: [{id: 'docker:proxy', mode: 'docker', container: 'proxy', running: true, syntax: 'passed', mounts: [{source: '/srv/conf', destination: '/etc/nginx/conf.d'}]}], sites: [{serverNames: ['vault.example.com'], hostConfig: '/srv/conf/vault.conf', loaded: true, https: true, upstreams: ['app:3000'], transfer: [{name: 'backup-upload', routes: [{clientMaxBodySize: '0', requestBuffering: 'off', responseBuffering: 'on', state: 'checked'}]}]}]});
    assert.match(lines.join('\n'), /vault\.example\.com/u);
    assert.match(lines.join('\n'), /\/srv\/conf → \/etc\/nginx\/conf\.d/u);
    assert.match(lines.join('\n'), /backup-upload: 0 \| off/u);
});
