/**
 * @file UpdateAllCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 处理批量更新命令并打印统一摘要。
 * @logic 1. 调用共享批量更新 service；2. 输出逐步 reporter 事件；3. 返回汇总结果。
 * @dependencies Service: ../services/plugin-service.js, Helper: ./shared.js
 * @index_tags update-all命令, 批量更新, CLI包装
 * @author holic512
 */

import {updateAllPlugins} from '../services/plugin-service.js';
import {printReporterEvent} from './shared.js';

export default async function updateAll() {
    return updateAllPlugins({reporter: printReporterEvent});
}
