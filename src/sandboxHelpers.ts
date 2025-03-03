import { TFile } from "obsidian";






/**
 * 判断当前文件是否匹配指定的路径模式数组
 * @param {string[]} patterns 可能包含全路径或短路径的数组
 * @returns {boolean} 是否匹配任意模式
 */


export function hasFileOrFolder(file: TFile, patterns: string[] | string): boolean {
    if (!file) return false;
    // 获取当前文件的完整路径并标准化
    const currentPath = file.path.replace(/\\/g, '/');
    const allParts = currentPath.split('/');
    const fileName = allParts[allParts.length - 1];

    if (typeof patterns === "string") {
        patterns = [patterns];
    }

    return patterns.some(pattern => {
        // 标准化路径格式
        const normalized = pattern.replace(/\\/g, '/');

        // 1. 完全匹配路径
        if (normalized === currentPath) return true;

        // 2. 完全匹配文件名
        if (normalized === fileName) return true;

        // 3. 分割模式为路径段
        const patternParts = normalized.split('/');

        // 4. 检查连续路径段匹配（支持深层匹配）
        for (let i = 0; i <= allParts.length - patternParts.length; i++) {
            const slice = allParts.slice(i, i + patternParts.length);
            if (slice.join('/') === normalized) return true;
        }

        // 5. 单一段匹配任意位置（目录或文件名）
        if (patternParts.length === 1 && allParts.includes(normalized)) {
            return true;
        }

        return false;
    });
}