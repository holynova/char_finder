# 韵脚画布

移动端中文押韵字查找工具：输入中文词句，取末字分析多音字读音、声母、韵母、押韵韵部和声调，实时给出可用韵脚。

![项目截图](./public/screenshot.png)

- 在线使用：https://holynova.github.io/char_finder/
- 源码仓库：https://github.com/holynova/char_finder
- 当前版本：v1.0.1

## 功能

- 输入即搜索，自动取最后一个汉字作为押韵目标。
- 多音字展示完整拼音，可切换不同读音对应的韵母结果。
- 支持「精确」模式，只查看完全匹配韵母的结果。
- 宽泛押韵会把更精确的韵母排在更前，例如 `in≈en` 时优先展示 `in`。
- 结果按常用程度排序，超过 6 个时用 `>` 展开全屏查看更多。
- 默认包含生僻字结果，便于找更丰富的押韵选择。

## 本地开发

```bash
npm install
npm run dev
```

## 发布构建

```bash
npm test
```

构建产物输出到 `docs/`，用于 GitHub Pages 发布。
