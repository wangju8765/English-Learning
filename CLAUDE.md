# English Craft — Minecraft 主题少儿英语学习应用

为 10 岁 Minecraft 爱好者定制的游戏化英语学习 Web 应用。词汇内容来自孩子编程学习中遇到的真实英语问题，每天 10-20 分钟，间隔重复算法确保一周掌握一批新词。

- **上线地址**: https://wangju8765.github.io/English-Learning/
- **仓库**: https://github.com/wangju8765/English-Learning

## 常用命令

```bash
cd app

npm run dev              # 启动开发服务器 (Vite HMR)
npm run build            # 构建生产版本（含词汇解析 → tsc → vite build）
npm run parse-vocabulary # 单独运行词汇解析，输出到 app/public/data/vocabulary.json
npm run preview          # 本地预览生产构建
npm run lint             # ESLint 检查
npx vitest               # 运行测试
```

## 添加词汇流程

1. 父亲记录孩子遇到的新单词列表
2. 用 AI 生成符合 `vocabulary/template.md` 格式的 md 文件，命名为 `YYYY-MM-DD.md`
3. 放入 `vocabulary/` 目录
4. `git add vocabulary/ && git commit -m "..." && git push`
5. GitHub Actions 自动构建部署，约 1 分钟后上线

**推送到 GitHub 后词汇自动更新，无需手动运行构建。**

## 词汇格式（关键约束）

使用 `vocabulary/template.md` 中的 **YAML front matter** 格式。旧中文标签格式仅作兼容保留，新文件必须用 YAML。

两个硬性规则：
- **`definition` 只能包含中文释义**，不得出现英文原词 — Diamond Mine 游戏用 definition 作为题干，英文会暴露答案
- **`phonetic` 使用 IPA 国际音标**，可用 https://tophonetics.com/ 查询

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 路由 | React Router v7 (HashRouter，适配 GitHub Pages) |
| 状态 | React Context + useReducer |
| 存储 | IndexedDB (idb-keyval) + localStorage 备份 |
| 语音 | Web Speech API (speechSynthesis) |
| 动画 | Framer Motion |
| 音效 | Web Audio API OscillatorNode（程序化生成，零文件体积） |
| 样式 | CSS Custom Properties（深色 HUD 主题） |
| 部署 | GitHub Pages + GitHub Actions |
| 解析 | tsx 运行 Node.js 脚本，构建时解析 md |

### 关键架构点

- **纯静态应用** — 无后端、无数据库、零运维成本
- **Hash 路由** — GitHub Pages 不支持 SPA fallback
- **构建时解析词汇** — md → JSON，前端只读 JSON
- **IndexedDB 主存储** — 不受 localStorage 5MB 限制
- **无文本输入框** — 所有游戏使用字母块点击拼词，避免系统 IME/键盘问题

## 项目结构

```
vocabulary/           ← 每日词汇 md（用户维护）
  template.md         ← 词汇格式模版
  YYYY-MM-DD.md       ← 每日词汇文件
app/
  src/
    App.tsx           ← 根组件 + 路由
    components/       ← 共享 UI 组件（Layout, AudioButton, WordDisplay）
    games/            ← 6 种已实现的游戏模式
      diamond-mine/    ← ⛏️ 钻石矿工（3×3 词义识别）
      crafting-table/  ← 🛠️ 工作台（点击拼词）
      echo-chamber/    ← 🎤 回音密室（逐字母拼读入门）
      ender-pearl/     ← 🎯 末影珍珠（计时点击拼词）
      redstone-quiz/   ← 🔴 红石问答（句子语境填空）
      note-block/      ← 🎵 音符盒工作室（三阶段听→写训练）
    pages/            ← 页面级组件（Home, Quest, Game, Progress, WordBook, Inventory, Settings）
    services/         ← IndexedDB、语音、音效、间隔重复
    store/            ← React Context + useReducer（AppContext, reducer）
    styles/           ← CSS Custom Properties + 主题变量
    types/            ← TypeScript 类型定义（WordState, GameEngine, XP_CONFIG 等）
    utils/            ← 工具函数
  scripts/
    parse-vocabulary.ts  ← md → JSON 解析器
  public/data/
    vocabulary.json   ← 解析生成的词汇数据（自动生成，38 个词条）
.github/workflows/
  deploy.yml          ← CI/CD 自动部署
```

## 学习路径

```
新词 → 🎤 Echo Chamber（逐字母拼读，建立音→字母映射）
  ↓
巩固 → 🎵 Note Block Studio（音节拆分→照抄→独立听写）
  ↓
练习 → 🛠️ Crafting Table / 🎯 Ender Pearl Challenge
  ↓
应用 → 🔴 Redstone Quiz（句子语境） / ⛏️ Diamond Mine（词义识别）
```

## 游戏模式（6/7 已实现）

### ⛏️ Diamond Mine（钻石矿工）
- 词义识别 — 3×3 矿墙，9 块砖中寻找对应中文释义的英文词（每面 2 个目标，最多 5 面墙）
- Combo 连击 XP 加成，🔊 手动听发音
- 难度 ⭐

### 🛠️ Crafting Table（工作台）
- 拼写训练 — 见中文释义，0 干扰字母，字母表序排列，4 列响应式网格大方块点击拼词
- 错误时字母槽填入正确答案 + 红色面板 + 朗读，停留 3.5s
- 难度 ⭐⭐

### 🎤 Echo Chamber（回音密室）
- 听→写入门 — 听单词 → 逐字母拼读(C-A-L-C-U-L-A-T-E) → 再听 → 拼写
- 拼错不跳过，必须拼对才能离开。🐢 慢速模式，重试 ≥3 次显示答案
- 难度 ⭐

### 🎯 Ender Pearl Challenge（末影珍珠挑战）
- 计时拼词 — 2 干扰字母，倒计时（10s 起，词长×3）内点击字母拼出单词
- 速度 XP 加成 + combo 连击，末影主题紫色 UI + 🎯 计时条绿→黄→红渐变
- 难度 ⭐⭐⭐

### 🔴 Redstone Quiz（红石问答）
- 句子语境填空 — 英文句子挖空（滴声遮盖），4 选 1，2×2 选项网格
- 中文翻译辅助理解，智能识别词形变化（复数/时态/动名词）
- 难度 ⭐⭐

### 🎵 Note Block Studio（音符盒工作室）
- 三阶段听→写训练：音节拆分(🟢) → 照抄(🟡) → 独立(🟠)
- Stage 1 按音节数重复 N 轮，元音高亮 + 点音节听发音
- 同一词走完三步才进入下一个，词量限制 6 个
- 难度 ⭐⭐

### 规划中
- 🌑 Nether Portal Escape（下界传送门逃脱）— 综合 BOSS 关

## 语音交互模式

三段式朗读（Crafting Table / Note Block）：`单词 → 指令 → 释义 → 单词`
逐字母拼读（Echo Chamber）：`单词 → C-A-L-C-U-L-A-T-E → 单词`
正确后读第 3 遍强化，错误时 0.85×慢速朗读 + 视觉停留 3.5s。

## 激励系统

- **XP**：基础 +10，速度加成 +1~5，Combo (combo-1)×2，Perfect Session +25，Daily Quest +50，Streak ×5
- **每日任务**：完成 2 个不同游戏模式 = +50 XP，自动检测发放
- **Streak**：连续学习天数，断签归零，≥3 天火焰脉冲动画

## 设计约束

- **深色 HUD 风格**（非银色 GUI），高对比度，保护儿童视力
- **字体策略**：像素字体 `Press Start 2P` 用于标题/HUD/导航（Minecraft 氛围），中文 `Noto Sans SC` 用于正文，系统原生 sans-serif 用于英文单词/字母显示
- **6 级间隔重复**（Stone → Coal → Iron → Gold → Diamond → Netherite），基于 SM-2 算法
- **目标用户是 10 岁孩子**，操作者是非技术背景的父亲 — UI 要直观，流程要简单

## 更多上下文

项目的设计决策、进度日志、故障排查记录等深层上下文存储在 memory 系统中（`~/.claude/projects/-Users-zeno-Documents-English-Learning/memory/`），包含 10 个文件覆盖项目概述、技术架构、游戏设计、内容管理等。需要深入了解时，查看这些 memory 文件。
