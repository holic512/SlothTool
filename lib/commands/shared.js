/**
 * @file SlothToolCommandShared
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 提供 CLI 命令层的共用输出能力，包括 reporter 事件打印与帮助兜底。
 * @logic 1. 将 service reporter 事件映射到 stdout/stderr；2. 统一减少命令层重复样板。
 * @dependencies Node: console
 * @index_tags CLI辅助, reporter输出, 命令层共享
 * @author holic512
 */

export function printReporterEvent(event) {
    if (!event?.message) {
        return;
    }

    if (event.level === 'error') {
        console.error(event.message);
        return;
    }

    if (event.level === 'warn') {
        console.warn(event.message);
        return;
    }

    console.log(event.message);
}
