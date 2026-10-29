# 代码结构重构方案

> 目标：让 `enhance.js` 从「2200 行单文件」演进为「多文件源码 + 构建产物」，便于长期维护（尤其是 AI Agent 参与开发）。

---

## 一、为什么要拆

| 问题 | 单文件现状 |
|---|---|
| 改动定位难 | 改一个面板要在 2200 行里搜索上下文 |
| UI 不一致 | CSS 散落在 `<style>` 注入、`cssText`、逐属性赋值三处，共 5 处样式入口 |
| 无法做静态检查 | 没有 lint / format / 类型约束保障一致性 |
| 无法单元测试 | 学号解析、版本映射这类纯逻辑被埋在脚本里 |
| 回归风险高 | 改样式容易误碰逻辑 |

---

## 二、候选方案对比

### 方案 A：多文件 + 零依赖拼装 ✅ 已采用

源码拆成多个 `.js` / `.css`，用一个 Node 自带能力的 `build.js`（约 130 行、无任何 npm 依赖）按清单顺序拼成单个脚本。

### 方案 B：Vite

能力最完整（ESM、TS、HMR、tree-shaking），但引入构建依赖与配置成本。对本仓库体量（~2200 行）收益边际不高。

### 方案 C：油猴原生 `@require` 远程加载 ❌ 不采用

```js
// @require https://cdn.jsdelivr.net/gh/.../src/ui/theme.js
```

| 风险 | 后果 |
|---|---|
| 依赖 CDN 实时可用 | CDN 异常 → 整个脚本不可用，无降级路径 |
| GreasyFork 规范要求 | `@require` 必须是 HTTPS 稳定地址 |
| 缓存不透明 | 改一处 CSS 用户端未必即时生效 |
| ScriptCat 差异 | 两个平台行为可能不一致 |

### 方案 D：Git submodule ❌ 不采用

更新需提交指针、clone 需 `--recursive`，对人与 Agent 都是额外负担。

### 对比表

| | 方案 A 拼装 | Vite | `@require` |
|---|---|---|---|
| npm 依赖 | **无** | 需要 | 无 |
| 文件级改动 | ✅ | ✅ | ✅ |
| CSS 独立文件 | ✅ | ✅ | ✅ |
| TS 类型检查 | ❌（可后补 JSDoc） | ✅ | ❌ |
| 产物形态 | 单个 `.user.js` | 单个 `.user.js` | 非单文件 |
| 运行可靠性 | 高 | 高 | **依赖 CDN** |

---

## 三、目录结构

```
build.js                    # 零依赖构建：拼 meta + 各源文件 + CSS
verify.js                   # 产物等价性校验（确保迁移不丢代码）
src/
  meta.txt                  # userscript 头（@match / @grant / @connect）
  core/
    config.js               # 配置项、数据源镜像、培养方案版本适配
    logging.js              # 日志面板 UI 与 Logger
    cache.js                # 本地缓存管理
    bootstrap.js            # 延迟初始化
    qiangzhi.js             # 强智科技页面检测
    dataSource.js           # 远程数据加载与课程映射
    courseEnhance.js        # 表格增强（大纲/类别标签）
    loginKeepAlive.js       # 登录状态保活
    main.js                 # 入口 init
  ui/
    modal.js                # 统一弹窗
    drag.js                 # 拖拽能力
    promoBanner.js          # 推广提示
    creditsPanel.js         # 学分统计悬浮窗
  evaluate/                 # 自动评教模块（原模块二）
    consts.js  evaluateCore.js  style.js  panel.js
    findPage.js  listPage.js  editPage.js
dist/
  enhance.user.js           # 构建产物（入库，供 jsDelivr 引用）
enhance.js                  # 根目录副本（兼容历史安装链接）
```

---

## 四、源码约定

1. **每个文件只做一件事**，文件名即职责
2. **现阶段共享同一作用域** —— 各文件拼接后处于同一个 IIFE 内，`build.js` 中的 `SOURCES` 顺序不可随意调整（被依赖的定义必须排在调用者之前）
   > 待后续将各文件改造为 `(function (App) { ... })(window.NJApp = window.NJApp || {});` 的命名空间形式后，此约束解除
3. **样式只写在 `.css` 文件里**，由构建注入；**禁止**在 JS 中新增 `cssText` 或 `<style>` 拼接

---

## 五、迁移路线图

- [x] **Phase 1 · 结构迁移**（已完��）
      按分区逐行切分为 20 个源文件，`npm run verify` 校验「基线代码行 0 丢失」
- [ ] **Phase 2 · UI 统一**
      抽出 `src/ui/theme.css`（设计 token：色板 / 圆角 / 阴影 / 字号 / z-index）与 `base.css`（`.nju-btn` 等原子类）；
      收敛现有三套设计语言（Apple 风 / 蓝灰风 / 简易 Bootstrap 风）
- [ ] **Phase 3 · 拖拽与交互归一**
      现有 3 份拖拽实现、3 份关闭按钮实现、2 份折叠实现 → 统一为单个工具
- [ ] **Phase 4 · 模块化收口**
      各文件改为命名空间 IIFE，`SOURCES` 顺序依赖解除，可补单元测试
- [ ] **Phase 5 · 评价体系迁移**
      `getKCDG.js` 采集脚本一并纳入 `src/` 与构建

---

## 六、本地开发

```bash
npm run build     # 构建 → dist/enhance.user.js + enhance.js
npm run verify    # 校验产物与基线是否等价（可分步传基线路径）
npm run check     # 构建 + 语法检查
```

修改流程：

1. 编辑 `src/` 下对应文件
2. `npm run build`
3. **连同 `dist/enhance.user.js` 与根目录 `enhance.js` 一起提交**（CI 会校验是否同步）

---

## 七、发布流程

采用双轨：

| 渠道 | 内容 |
|---|---|
| 仓库 `dist/enhance.user.js` | 提交入库，jsDelivr 可直接引用 `@latest/dist/enhance.user.js` |
| GitHub Release 附件 | 打 `v*` tag 时由 Actions 自动构建并挂载 |

CI（`.github/workflows/build.yml`）负责：

- 每次 push / PR → 构建 + 语法检查 + **校验产物与源码是否同步**（不同步直接失败）
- 打 `v*` tag → 额外产出 Release 附件

---

## 八、将来升级到 Vite

源码已按「每文件单一职责」组织，升级路径只需两步：

1. 各文件顶部改为 `import` / 底部 `export`（或改为命名空间 IIFE 后直接可用）
2. 用 `vite build --lib` 输出单文件，并在 `rollupOptions.output.banner` 中写入 `src/meta.txt`，
   CSS 通过 `?inline` 导入后自行注入

无需重新拆分业务逻辑。
