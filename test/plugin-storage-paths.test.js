/**
 * @file PluginStoragePathsTest
 * @project SlothTool
 * @module Test / Shared Plugin Storage
 * @description 验证独立插件从统一的 Pipker SlothTool 数据目录读取全局语言设置。
 * @logic 1. 使用隔离 HOME 创建全局设置；2. 分别读取各官方插件语言模块；3. 确认旧 ~/.slothtool 不参与回退。
 * @dependencies Node: assert/fs/os/path/test; Plugins: official plugin i18n modules including pzip and slothvault-mcp
 * @index_tags 插件测试, 存储路径, pipker, 全局语言, i18n, pzip, slothvault-mcp
 * @author holic512
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {getLanguage as getCodexModelsLanguage} from '../plugins/codex-models/lib/i18n.js';
import {getLanguage as getGstoreLanguage} from '../plugins/gstore/lib/i18n.js';
import {getLanguage as getImageCompressLanguage} from '../plugins/image-compress/lib/i18n.js';
import {getLanguage as getLocLanguage} from '../plugins/loc/lib/i18n.js';
import {getLanguage as getPzipLanguage} from '../plugins/pzip/lib/i18n.js';
import {getLanguage as getSlothVaultMcpLanguage} from '../plugins/slothvault-mcp/lib/i18n.js';
import {getLanguage as getTemplateLanguage} from '../plugins/template-basic/lib/i18n.js';

test('plugins read shared language settings from the Pipker SlothTool home only', () => {
    const previousHome = process.env.HOME;
    const previousUserProfile = process.env.USERPROFILE;
    const previousLanguage = process.env.SLOTHTOOL_LANGUAGE;
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-plugin-storage-home-'));
    const settingsDir = path.join(homeDir, '.pipker', 'slothtool');

    fs.mkdirSync(settingsDir, {recursive: true});
    fs.writeFileSync(path.join(settingsDir, 'settings.json'), JSON.stringify({language: 'en'}));
    fs.mkdirSync(path.join(homeDir, '.slothtool'), {recursive: true});
    fs.writeFileSync(path.join(homeDir, '.slothtool', 'settings.json'), JSON.stringify({language: 'zh'}));

    process.env.HOME = homeDir;
    process.env.USERPROFILE = homeDir;
    delete process.env.SLOTHTOOL_LANGUAGE;

    try {
        assert.equal(getLocLanguage(), 'en');
        assert.equal(getPzipLanguage(), 'en');
        assert.equal(getGstoreLanguage(), 'en');
        assert.equal(getImageCompressLanguage(), 'en');
        assert.equal(getCodexModelsLanguage(), 'en');
        assert.equal(getSlothVaultMcpLanguage(), 'en');
        assert.equal(getTemplateLanguage(), 'en');
    } finally {
        if (previousHome === undefined) {
            delete process.env.HOME;
        } else {
            process.env.HOME = previousHome;
        }

        if (previousUserProfile === undefined) {
            delete process.env.USERPROFILE;
        } else {
            process.env.USERPROFILE = previousUserProfile;
        }

        if (previousLanguage === undefined) {
            delete process.env.SLOTHTOOL_LANGUAGE;
        } else {
            process.env.SLOTHTOOL_LANGUAGE = previousLanguage;
        }
    }
});
