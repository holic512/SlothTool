/**
 * @file SelfUpdateCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 处理 SlothTool 本体自更新命令。
 * @logic 1. 调用共享自更新 service；2. 使用 reporter 输出开始与结果状态。
 * @dependencies Service: ../services/plugin-service.js, Helper: ./shared.js
 * @index_tags self-update, 本体更新, CLI包装
 * @author holic512
 */

import {updateSelf} from '../services/plugin-service.js';
import {printReporterEvent} from './shared.js';

export default function selfUpdate() {
    return updateSelf({reporter: printReporterEvent});
}
