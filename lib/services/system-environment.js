/**
 * @file SlothToolSystemEnvironmentService
 * @project SlothTool
 * @module Core CLI / Services
 * @description 提供当前系统类型与 CPU 架构的标准化探测能力，供后续非 Node 插件安装流程选择对应安装包。
 * @logic 1. 读取 Node 原始 platform/arch；2. 转换为安装场景更稳定的 windows/linux/macos 与 amd64/arm64 标签；3. 输出布尔标记与组合 target 方便上层直接判断。
 * @dependencies Node: os
 * @index_tags 系统环境, 平台探测, 架构探测, macos, linux, windows, amd64, arm64
 * @author holic512
 */

import os from 'node:os';

export function normalizeSystemPlatform(platform) {
    if (platform === 'darwin') {
        return 'macos';
    }

    if (platform === 'win32') {
        return 'windows';
    }

    if (platform === 'linux') {
        return 'linux';
    }

    return platform || 'unknown';
}

export function normalizeSystemArchitecture(architecture) {
    if (architecture === 'x64') {
        return 'amd64';
    }

    if (architecture === 'arm64') {
        return 'arm64';
    }

    if (architecture === 'arm') {
        return 'arm';
    }

    if (architecture === 'ia32') {
        return '386';
    }

    return architecture || 'unknown';
}

export function getSystemEnvironment(options = {}) {
    const rawPlatform = options.platform || process.platform;
    const rawArchitecture = options.arch || process.arch;
    const operatingSystem = normalizeSystemPlatform(rawPlatform);
    const cpuArchitecture = normalizeSystemArchitecture(rawArchitecture);

    return {
        operatingSystem,
        cpuArchitecture,
        rawPlatform,
        rawArchitecture,
        release: options.release || os.release(),
        target: `${operatingSystem}-${cpuArchitecture}`,
        isWindows: operatingSystem === 'windows',
        isLinux: operatingSystem === 'linux',
        isMacOS: operatingSystem === 'macos',
        isArm: cpuArchitecture.startsWith('arm'),
        isArm64: cpuArchitecture === 'arm64',
        isAmd64: cpuArchitecture === 'amd64'
    };
}

export default {
    getSystemEnvironment,
    normalizeSystemArchitecture,
    normalizeSystemPlatform
};
