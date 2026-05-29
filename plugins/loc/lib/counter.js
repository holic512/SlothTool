/**
 * @file LocCounter
 * @project SlothTool
 * @module LOC Plugin / Core
 * @description 负责递归统计目录代码行数，并以结构化结果返回文件清单与告警信息。
 * @logic 1. 按扩展名和排除目录过滤文件；2. 递归扫描目录并累计文件数/行数；3. 将读写异常收集到 warnings 而不直接打印。
 * @dependencies Node: fs/path
 * @index_tags 行数统计, 递归扫描, 文件过滤, 结构化结果
 * @author holic512
 */

import fs from 'node:fs';
import path from 'node:path';

export function countLines(dir, config = null) {
    const summary = {
        fileCount: 0,
        lineCount: 0,
        files: [],
        warnings: []
    };

    const fileExtensions = config?.fileExtensions || null;
    const excludeDirectories = config?.excludeDirectories || null;

    function scan(currentPath) {
        let stats;

        try {
            stats = fs.statSync(currentPath);
        } catch (error) {
            summary.warnings.push(`Skip inaccessible path ${currentPath}: ${error.message}`);
            return;
        }

        if (stats.isFile()) {
            if (fileExtensions) {
                const extension = path.extname(currentPath).slice(1);
                if (!fileExtensions[extension]) {
                    return;
                }
            }

            try {
                const content = fs.readFileSync(currentPath, 'utf8');
                const lines = content.split('\n').length;
                summary.fileCount += 1;
                summary.lineCount += lines;
                summary.files.push({
                    path: currentPath,
                    lines
                });
            } catch (error) {
                summary.warnings.push(`Skip unreadable file ${currentPath}: ${error.message}`);
            }

            return;
        }

        if (!stats.isDirectory()) {
            return;
        }

        try {
            const entries = fs.readdirSync(currentPath);
            for (const entry of entries) {
                if (excludeDirectories?.[entry]) {
                    continue;
                }

                scan(path.join(currentPath, entry));
            }
        } catch (error) {
            summary.warnings.push(`Skip unreadable directory ${currentPath}: ${error.message}`);
        }
    }

    scan(dir);
    return summary;
}

export default {
    countLines
};
