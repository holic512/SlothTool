const fs = require('fs');
const path = require('path');

/**
 * 统计目录中的代码行数
 * @param {string} dir - 目标目录
 * @returns {Object} 统计结果 { fileCount, lineCount, files }
 */
function countLines(dir) {
  let fileCount = 0;
  let lineCount = 0;
  const files = [];

  function scan(currentPath) {
    let stat;

    try {
      stat = fs.statSync(currentPath);
    } catch (error) {
      console.error(`Error accessing ${currentPath}:`, error.message);
      return;
    }

    if (stat.isFile()) {
      // 统计文件行数
      try {
        const content = fs.readFileSync(currentPath, 'utf8');
        const lines = content.split('\n').length;
        fileCount++;
        lineCount += lines;
        files.push({
          path: currentPath,
          lines: lines
        });
      } catch (error) {
        // 跳过无法读取的文件（如二进制文件）
        console.warn(`Skipping ${currentPath}: ${error.message}`);
      }
    } else if (stat.isDirectory()) {
      // 递归扫描目录
      try {
        const entries = fs.readdirSync(currentPath);
        for (const entry of entries) {
          // 跳过 node_modules 和隐藏文件/目录
          if (entry === 'node_modules' || entry.startsWith('.')) {
            continue;
          }
          scan(path.join(currentPath, entry));
        }
      } catch (error) {
        console.error(`Error reading directory ${currentPath}:`, error.message);
      }
    }
  }

  scan(dir);

  return { fileCount, lineCount, files };
}

module.exports = { countLines };
