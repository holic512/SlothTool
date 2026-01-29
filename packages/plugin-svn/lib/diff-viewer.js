const chalk = require('chalk');
const {t} = require('./i18n');

/**
 * 格式化并显示 diff 内容
 * @param {string} diffOutput - svn diff 的原始输出
 * @param {string} filePath - 文件路径
 */
function displayDiff(diffOutput, filePath) {
    console.log(chalk.cyan.bold(`\n${t('diffFor')} ${filePath}\n`));

    if (!diffOutput || diffOutput.trim() === '') {
        console.log(chalk.gray(t('noDiffFiles')));
        return;
    }

    const lines = diffOutput.split('\n');

    lines.forEach(line => {
        if (line.startsWith('+++') || line.startsWith('---')) {
            // 文件头
            console.log(chalk.bold(line));
        } else if (line.startsWith('@@')) {
            // 位置信息
            console.log(chalk.cyan(line));
        } else if (line.startsWith('+')) {
            // 新增行
            console.log(chalk.green(line));
        } else if (line.startsWith('-')) {
            // 删除行
            console.log(chalk.red(line));
        } else if (line.startsWith('Index:') || line.startsWith('===')) {
            // SVN 特有的头部信息
            console.log(chalk.blue(line));
        } else {
            // 上下文行
            console.log(chalk.gray(line));
        }
    });

    console.log(''); // 空行
}

/**
 * 显示简化的 diff 摘要
 * @param {string} diffOutput - svn diff 的原始输出
 * @returns {Object} diff 统计信息
 */
function getDiffStats(diffOutput) {
    if (!diffOutput || diffOutput.trim() === '') {
        return {additions: 0, deletions: 0, changes: 0};
    }

    const lines = diffOutput.split('\n');
    let additions = 0;
    let deletions = 0;

    lines.forEach(line => {
        if (line.startsWith('+') && !line.startsWith('+++')) {
            additions++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
            deletions++;
        }
    });

    return {
        additions,
        deletions,
        changes: additions + deletions
    };
}

/**
 * 显示 diff 统计信息
 * @param {Object} stats - diff 统计对象
 */
function displayDiffStats(stats) {
    if (stats.changes === 0) {
        console.log(chalk.gray('No changes'));
        return;
    }

    const parts = [];

    if (stats.additions > 0) {
        parts.push(chalk.green(`+${stats.additions}`));
    }

    if (stats.deletions > 0) {
        parts.push(chalk.red(`-${stats.deletions}`));
    }

    console.log(`  ${parts.join(' ')}`);
}

/**
 * 创建可视化的变更条
 * @param {number} additions - 新增行数
 * @param {number} deletions - 删除行数
 * @param {number} maxWidth - 最大宽度
 * @returns {string} 可视化条
 */
function createChangeBar(additions, deletions, maxWidth = 50) {
    const total = additions + deletions;
    if (total === 0) return '';

    const addWidth = Math.round((additions / total) * maxWidth);
    const delWidth = maxWidth - addWidth;

    const addBar = chalk.green('█'.repeat(addWidth));
    const delBar = chalk.red('█'.repeat(delWidth));

    return addBar + delBar;
}

/**
 * 显示文件列表的 diff 摘要
 * @param {Array<Object>} fileDiffs - 文件 diff 数组 [{file, diff}]
 */
function displayDiffSummary(fileDiffs) {
    console.log(chalk.bold('\n=== Diff Summary ===\n'));

    let totalAdditions = 0;
    let totalDeletions = 0;

    fileDiffs.forEach(({file, diff}) => {
        const stats = getDiffStats(diff);
        totalAdditions += stats.additions;
        totalDeletions += stats.deletions;

        if (stats.changes > 0) {
            console.log(chalk.white(file));
            displayDiffStats(stats);
            console.log(createChangeBar(stats.additions, stats.deletions));
            console.log('');
        }
    });

    console.log(chalk.bold('Total:'));
    console.log(chalk.green(`  +${totalAdditions} additions`));
    console.log(chalk.red(`  -${totalDeletions} deletions`));
    console.log('');
}

/**
 * 高亮显示冲突标记
 * @param {string} content - 文件内容
 */
function highlightConflicts(content) {
    const lines = content.split('\n');

    lines.forEach(line => {
        if (line.startsWith('<<<<<<<')) {
            console.log(chalk.red.bold(line));
        } else if (line.startsWith('=======')) {
            console.log(chalk.yellow.bold(line));
        } else if (line.startsWith('>>>>>>>')) {
            console.log(chalk.green.bold(line));
        } else {
            console.log(line);
        }
    });
}

module.exports = {
    displayDiff,
    getDiffStats,
    displayDiffStats,
    createChangeBar,
    displayDiffSummary,
    highlightConflicts
};
