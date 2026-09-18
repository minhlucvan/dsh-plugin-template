# DeepSeek Harness 插件模板

[English](README.md) | 中文

面向 ESM Cordis 插件的自包含独立仓库模板。仓库用到的每个源文件、编译器配置、测试夹具、贡献说明、skill 和构建辅助都位于本目录内;每个开发输入都从本仓库根目录以下解析。

普通 npm 依赖从包 registry 解析。DSH 宿主是成品包的运行时消费者,不是源码或构建输入。

## 仓库布局

```text
.
├── .agents/skills/               # 仓库本地插件开发工作流
│   ├── dsh-plugin-development/   # 端到端协调器
│   └── dsh-plugin-*/             # plan、scaffold、implement、compose、test、release
├── docs/
│   └── dsh-plugin-contracts.md   # 所有插件 skill 共享的本地契约
├── patches/
│   └── README.md                 # 依赖补丁与 DSH host patch 契约
├── scripts/
│   ├── check-package.mjs         # 校验打包归档覆盖 manifest 声明的路径
│   ├── extract-patch.mjs         # 配置驱动的 host patch 再生成(见 patches/README.md)
│   ├── patch.sh                  # 幂等的 host patch 应用
│   ├── wrap-client.mjs           # 把 client bundle 包进 ModuleLoader envelope
│   └── verify-client.mjs         # 通过 loader shim 加载构建后的 client 产物
├── src/
│   ├── client/                   # 浏览器面
│   │   ├── store.ts              # zustand store:设置状态与 action
│   │   ├── context.tsx           # 每实例 store 的 provider 与其读取器
│   │   ├── hooks.ts              # 组件使用的读取路径
│   │   ├── settings-section.tsx  # 布局,组合下面各部分
│   │   ├── message-field.tsx     # 展示型字段,通过 hook 取状态
│   │   ├── save-controls.tsx     # 提交与重置,通过 hook 取状态
│   │   ├── settings-page.tsx     # slot 接缝:props 进,provider 出
│   │   ├── contracts.ts          # 窄浏览器宿主契约
│   │   ├── locale.ts             # 功能自有字典
│   │   └── settings.ts           # 持久化形状、默认值与归一化
│   ├── README.md                 # 服务与功能模块的增长规则
│   ├── commands.ts               # 基于 ctx.commands 的 slash command companion
│   ├── config.ts                 # 可序列化 schema 与解析后的默认值
│   ├── index.ts                  # Loader 面向的函数插件命名空间
│   ├── invariant.ts              # 包自有的 invariant companion
│   ├── routes.ts                 # 基于 ctx.webServer 的 HTTP route companion
│   ├── runtime.ts                # 可 fake 的宿主边界与 Cordis 激活
│   ├── skills.ts                 # 基于 ctx.skills 的运行时 skill 贡献
│   └── tools.ts                  # 基于 ctx.tools 的 tool 注册 companion
├── tests/
│   ├── README.md                 # harness、功能测试与快照约定
│   ├── client-components.test.tsx  # store、context、hook 与组件(jsdom)
│   ├── client-registration.test.ts  # slot 注册与 fiber 销毁
│   ├── client-store.test.ts      # store 状态迁移与宿主同步(Node)
│   ├── client.test.ts            # settings 归一化、receiver 绑定、locale 对齐
│   ├── companions.test.ts        # tool、route、command 与 skill companion
│   ├── harness.ts                # 共享的真实 Cordis 测试挂载
│   ├── plugin.test.ts            # Loader 导出、激活与 companion 销毁
│   ├── setup-dom.ts              # 组件测试之间的 jsdom 清理
│   └── snapshots/
│       └── README.md             # 可选的产品可见 fixture 契约
├── .oxlintrc.json                 # 类型感知的 Oxlint 配置
├── .gitignore                    # 生成产物排除
├── AGENT.md                      # 面向编码 agent 的仓库契约
├── AGENTS.md                     # 仓库本地贡献规则
├── CLAUDE.md                     # 面向 Claude 会话的同一契约
├── LICENSE                       # 模板许可证
├── README.md                     # 仓库与使用契约
├── cordis.patch.yml              # profile bundle 贡献
├── package.json                  # 导出、peers、dsh.bundle.patch、dsh.client
├── pnpm-lock.yaml                # 可复现的 registry 依赖图
├── pnpm-workspace.yaml           # 包管理器与可选补丁策略
├── tsconfig.json                 # 编译器与类型感知 lint 工程
├── tsdown.config.ts              # 从源码直接构建运行时与声明
├── tsdown.client.config.ts       # 独立的 CommonJS 浏览器构建
└── vitest.config.ts              # 测试运行器配置
```

## 可扩展的源码与测试结构

一个包可以只有宿主侧、只有客户端侧,或同时具备宿主与浏览器两面。把 Loader 元数据、配置、运行时/服务边界、浏览器行为、共享契约与测试放在与包相匹配的属主中;模板不要求每个插件复制同一套固定目录。

模板的示例骨架使用 `src/index.ts`、`src/config.ts`、`src/runtime.ts`、`src/invariant.ts`、`src/tools.ts`、`src/commands.ts`、`src/routes.ts`、`src/skills.ts`、`src/client/`、`tests/harness.ts` 与 `tests/plugin.test.ts`;当这些属主适合你的包时保留它们,任何刻意的替换都要写入文档。稳定的产品可见期望输出属于该包实际的快照属主。依赖补丁与 DSH host patch 在需要时使用可选的 `patches/` 契约。

Turtle UI 的 chat、components、extension 目录描述的是那个产品,不是 DSH 插件契约。只有新插件真正拥有那些能力时才创建对应的功能目录。本地规则见 `src/README.md`、`tests/README.md`、`tests/snapshots/README.md` 与 `patches/README.md`。

## 创建你的插件

1. 在 `package.json`、Loader 属主、配置/运行时/invariant 属主、对应的测试属主、bundle 元数据、TypeScript 元数据、`README.md` 与 `AGENT.md`/`CLAUDE.md`/`AGENTS.md` 中替换包身份。示例骨架明确列出了这些属主;刻意的替换必须同时更新包本地文档与静态分析配置。
2. 在替换身份前先明确完整的 npm 包名。包名可以是 scoped 或 unscoped（例如 `comem`），不要默认继承模板的 `@your-scope/dsh-` 前缀。将选定包名原样用于 `package.json`、bundle 行、invariant 注册、exports、测试和文档。只在上述身份属主中替换模板包名 `@minhlucvan/dsh-plugin-template` 和插件 id。不要对 `.agents/skills/` 做全局替换;它的通用示例与标记检查必须保持可复用。
3. 更新 `description`、`keywords`、`LICENSE` 与 `cordis.patch.yml`。
4. 只把实现用到的 DSH 宿主服务加入包契约与组合补丁。源码和构建依赖必须能从本仓库的 `node_modules` 解析。
5. 当包拥有权威事件或可变数据关系时,替换空的 invariant installer。
6. 在 `src/runtime.ts` 实现激活与宿主边界行为,按需把内聚能力移入项目专属的 `src/<feature>/` 目录。保持 `src/index.ts` 只含 Loader 元数据与公共 re-export,并通过 `ctx.effect()`、`ctx.on()` 或 registry disposer 限定注册范围。
7. 保持每个源码、编译器、文档和工程引用路径都在本仓库内。从项目根描述文件,例如 `docs/dsh-plugin-contracts.md`。不要添加本地路径 `link:` 或 `file:` 依赖。
8. 只有当包的公共依赖与分发产物就绪时,才把 `private` 设为 `false`。

不要给函数插件添加 default export。Cordis Loader 会解包 `exports.default ?? exports`;多余的 default export 会丢弃 `inject`、`Config`、`apply` 等命名空间导出。

## 内置开发 skills

DSH 会发现在 `.agents/skills/` 下的仓库本地工作流。完整流程从 [`dsh-plugin-development`](.agents/skills/dsh-plugin-development/SKILL.md) 开始,也可以直接调用某一阶段:

| Skill | 用途 |
|---|---|
| [`dsh-plugin-plan`](.agents/skills/dsh-plugin-plan/SKILL.md) | 决定插件形态、依赖、配置、invariant、组合与证据。 |
| [`dsh-plugin-scaffold`](.agents/skills/dsh-plugin-scaffold/SKILL.md) | 从本模板实例化并基线验证新仓库。 |
| [`dsh-plugin-align`](.agents/skills/dsh-plugin-align/SKILL.md) | 在不替换产品行为的前提下，把非模板仓库迁移到本工具链。 |
| [`dsh-plugin-implement`](.agents/skills/dsh-plugin-implement/SKILL.md) | 实现生命周期安全的 Cordis 行为、元数据、文档与 invariants。 |
| [`dsh-plugin-i18n`](.agents/skills/dsh-plugin-i18n/SKILL.md) | 用类型化字典、locale seat、fallback 与销毁证据本地化浏览器 UI。 |
| [`dsh-plugin-compose`](.agents/skills/dsh-plugin-compose/SKILL.md) | 把 bundle 安装进隔离 profile 并证明有效激活。 |
| [`dsh-plugin-test`](.agents/skills/dsh-plugin-test/SKILL.md) | 验证 Loader 导出、行为、销毁、组合、快照与产物。 |
| [`dsh-plugin-release`](.agents/skills/dsh-plugin-release/SKILL.md) | 在不隐式发布的前提下检查本地、Git 或 npm 分发就绪度。 |

复制模板时保留这些目录,这样未来扎根于插件仓库的会话能沿用同一工作流。

## 独立开发

所有命令都在本目录运行:

```sh
pnpm install
pnpm run lint
pnpm test
pnpm run build
```

`pnpm install` 只解析本包声明的依赖。`lint` 使用启用类型感知分析的 Oxlint 并拒绝警告,检查配置的源码与测试工程。`build` 直接从 `src/` 编译 host entry,向 `lib/` 输出可直接打包的运行时 JavaScript 与声明,不运行安装期 lifecycle build。额外参数会透传给 tsdown,因此本地调试可用 `pnpm run build --sourcemap` 产出 source map;默认 `build` 不产 map。

因为本包同时具备宿主面与浏览器面,`build` 实际上是两次构建:

- `pnpm run build:host` — 由 `tsdown.config.ts` 构建 `lib/` 中的宿主 entry;
- `pnpm run build:client` — 构建 CommonJS 浏览器 bundle,再用
  `scripts/wrap-client.mjs` 把它包进 ModuleLoader envelope,并用
  `scripts/verify-client.mjs` 通过 loader shim 加载产物进行校验。

`pnpm run build` 会依次执行两者。只改其中一面时可先用更窄的命令,完整构建是提交前的门槛。

release 产物在打包前从 `src/` 构建。profile 或 consumer 安装消费现成的 `lib/` 输出，不运行 `prepare`；`node scripts/check-package.mjs` 校验归档覆盖 `exports`、`main`、`types` 与 `dsh.bundle.patch` 声明的每个路径,`pnpm pack --dry-run --json` 打印最终归档内容。

## CI

模板自带两个 GitHub Actions 工作流:

- `.github/workflows/ci.yml` — 每次推送到 `main` 与每个 pull request:冻结 lockfile 安装,然后运行 Oxlint、测试、完整构建与 `scripts/check-package.mjs`。它在 Node 22 与 Node 24 上以 `fail-fast: false` 运行,因为包支持其 `engines` 区间的两端,失败信息应指明是哪个版本回归。该工作流只读(`permissions: contents: read`),并会取消同一 ref 上被取代的运行。
- `.github/workflows/release.yml` — 每次推送到 `main`,或手动触发:执行同样的检查,把现成 tarball 打包为 `dist/pkg.tgz`,并附加到以 `package.json` 中 `v<version>` 命名的 GitHub Release,不存在时创建该 Release。它使用 `fetch-depth: 0` 检出,以便 `--generate-notes` 能拿到所需历史。

提升 `package.json` 中的 `version` 即发布新版本;不提升版本再次推送会刷新已有 Release 的产物。发布到 npm 不是自动化的。

## Profile 激活

包 manifest 声明 bundle 补丁:

```json
{
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

DSH 宿主可以把本包安装进 profile,并用 `cordis.patch.yml` 覆盖自身的运行时组合。该宿主集成刻意位于本仓库的构建与测试输入之外。补丁只组合插件;它不修改宿主源码、编译器设置、构建脚本或 catalog。

invariant companion 通过窄本地接口使用宿主的 `invariants` 服务。这让包构建不依赖宿主私有源码包,同时保留启用了 invariants 的 DSH profile 使用的运行时注册。只有在消费 profile 提供该服务时才插入 companion 行；普通 `dsh-base`/`dsh-web-app` profile 应省略这一行，否则 entry 会一直 pending。

## 客户端面

一个包除了宿主行为,也可以贡献浏览器 UI。本模板在 `src/client/` 中就是这样做的,它的构建与宿主 entry 有三处值得在复制前了解的差异。

**产物不是 ES module。** 宿主会直接求值插件的 client 文件,并期望它调用 `window.__ModuleLoader__.load({ id, factory })`,其中 factory 的行为类似 CommonJS:它收到一个能解析宿主自身模块的 `require`,并返回插件的导出。因此 `pnpm run build` 并不止于打包器 —— `scripts/wrap-client.mjs` 会把 CommonJS 中间产物包进该 envelope,并重命名 tsdown 以 `.d.cts` 为后缀的声明文件。

**格式是 CommonJS,React 是 external。** `tsdown.client.config.ts` 单独构建 client:`format: ['cjs']`、浏览器 target,并用 `deps.neverBundle` 排除 `react` 与 `react/jsx-runtime`,因为它们由宿主提供。把 React 声明为 `devDependency` 是正确的 —— 构建与类型检查需要它,但它从不参与发布。

**构建成功不能证明 UI 可用。** `scripts/verify-client.mjs` 会安装一个 `__ModuleLoader__` shim,提供宿主模块,导入产物,并断言 loader id 与 `apply` / `inject` / `name` 导出。一个产物完全可能通过构建、打包与分发,却在这几步上全部失败,而唯一症状就是面板永远不出现。

有两个 tsconfig 设置是关键且容易丢失的:`"types"` 必须包含 `"react"`,否则 JSX 类型无法解析,`event.target.value` 会在 `HTMLInputElement` 上报缺失;`"lib"` 必须包含 `DOM`,而 `@tsconfig/node24` 并未设置它 —— 缺少时 DOM 类型会变成错误类型,每个事件处理器都成了 `any`。

用 `package.json` 中的 `dsh.client` 接上浏览器半边,并列出该 entry 注入的宿主 client 包:

```json
{
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-locale"] }
  }
}
```

### 状态:zustand,通过 context 作用域化

浏览器面是一棵 React 树,配一个 **zustand** store,并按下述分层组织,因此新增一个字段意味着新增一个 hook 和一个组件,而不是层层传 props:

| 层 | 文件 | 职责 |
|---|---|---|
| Store | `src/client/store.ts` | 全部可变设置状态及其上的 action |
| Context | `src/client/context.tsx` | 每个插件实例一个 store,以及 provider |
| Hooks | `src/client/hooks.ts` | 组件唯一受支持的读取路径 |
| 组件 | `src/client/settings-section.tsx`、`message-field.tsx`、`save-controls.tsx` | 只渲染,且仅通过 hook 读状态 |
| 接缝 | `src/client/settings-page.tsx` | 接收 slot 的 props,挂载 provider |

复制时值得保留的三个决定:

**store 用 vanilla zustand,而不是 React 版本。** 来自 `zustand/vanilla` 的 `createStore` 不引入 React,因此状态规则可以在纯 Node 下做单元测试,不需要 DOM —— 这也是 `tests/client-store.test.ts` 跑在 `node` 项目、而组件测试跑在 `jsdom` 的原因。

**zustand 是被打包进去的,不是宿主提供的。** 宿主的浏览器 loader 提供 `react`、`react/jsx-runtime`、`react-dom` 以及它自己的 `@deepseek-ai/*` client 包;它不提供 zustand。因此 zustand 是一个 `devDependency`,会被打进 `lib/client.js`。不要把它加进 `deps.neverBundle` —— 那会留下宿主无法解析的 `require('zustand')`。代价很小(几 kB;在 React 19 下 `use-sync-external-store` shim 不会被打进来),而且宿主自身用的是 `useSyncExternalStore` 而非 zustand,所以不存在需要对齐的版本。

**每个实例一个 store,由 provider 创建。** 模块级 store 会被每一份挂载的插件副本以及每个测试共享,于是两个实例会悄悄互相改写。`SettingsStoreProvider` 在 `useState` 初始化器里创建 store(而不是用 React 可能丢弃的 `useMemo`),并通过 context 向下传递。在 provider 之外调用 hook 会抛出带名字的错误,而不是渲染出 `undefined`。

store 把宿主 scope 当作外部权威:`connectSettingsScope` 把它镜像进来,当表单**干净**时到达的变更会被跟随,而**编辑中**到达的变更会保留已输入文本、只重置基线。保存失败同样保留草稿并记录原因,而不是丢弃用户输入。

### 最丰富的 slot:右侧栏标签页

本模板演示的 `settings.section` 座位是简单的列表 slot。右侧栏是另一个极端 —— 一个**可停靠的标签页注册表** —— 形态不同,因此在需要之前值得了解。此处只做文档说明,不做演示。

注册是**两阶段的,且两者都必需**:只注册标签页类型而不注册 body,渲染出的是外壳的"没有任何视图可以显示它"提示,而不是一个空面板。

**阶段一** —— 类型本身是什么,注册进 `ctx.sidebarRightTabs`:

```ts
ctx.effect(
  () =>
    ctx.sidebarRightTabs.register({
      id: '@minhlucvan/dsh-plugin-template',   // 唯一;阶段二据它注册 body
      kind: 'plugin-template-console',         // openTab 使用的名字
      // 页面型类型省略 `patterns`,它不识别任何地址,由 kind 打开。
      // 若提供,它们是 VS Code 风格的 scheme:// URI glob;含 `:` 的模式
      // 匹配整个地址而非路径。
      priority: 'extension',                   // 默认值,也是插件应处的区间
      title: () => t('tabTitle'),              // thunk:每次重新读取,语言切换会重渲染
      guide: [{ order: 50, title: () => t('tabTitle'), description: () => t('tabHint') }],
    }),
  'client: tab type',
)
```

`priority: 'extension'` 是默认值,也是插件并非二等视图的原因:什么都不声明的类型优先于产品自带的每个标签页类型,并且可以在其注销前接管某个 `builtin` 的 kind。同一区间内的第二次注册,或已在使用中的 `id`,都会抛错 —— 注册表把两者都视为接线错误,而不是任选其一。

**阶段二** —— body,注册进**以 key 寻址**的座位,key 即阶段一的 `id`:

```ts
ctx.effect(
  () =>
    ctx.slots.inject('sidebar.right.pane.tab', () =>
      ctx.slots.register(
        { name: 'sidebar.right.pane.tab', key: '@minhlucvan/dsh-plugin-template', locale: NS, store, inject },
        ConsoleBody,
      ),
    ),
  'client: tab body',
)
```

注意是 `key`,不是 `id`:以 key 寻址的座位由定义的标识来寻址。该 body 会收到该 kind 的每个标签页,无论停靠还是浮动。

`sidebar.right.pane.tab.title` 是一个独立的、以 key 寻址的注册,用于**实时**标题 —— 适用于标题来自自身 store 而非标签页打开时捕获文本的类型。省略它,标题就会一直保留打开时的 `title(address)` 文本。

## 插件形态

本模板演示函数插件,因此使用命名导出:

```ts
// src/index.ts
export const name = 'plugin-template'
export const inject: string[] = []
export { Config } from './config.ts'
export { apply } from './runtime.ts'

// src/config.ts
export interface Config { /* 可序列化字段 */ }
export const Config: z<Config> = z.object({ /* 校验与默认值 */ })

// src/runtime.ts
export function apply(ctx: Context, config: Config): void { /* effects */ }
```

服务提供者通常改为 default-export 它的 `Service` 子类。两种形态不要混用。

## 分发检查

在考虑 packed 或 GitHub Release 分发前，构建并检查最终归档:

```sh
pnpm run lint
pnpm test
pnpm run build
node scripts/check-package.mjs
pnpm pack --dry-run --json
```

最终包必须包含 `main`、`types`、`exports` 与 `files` 命名的每个运行时与声明文件;当归档缺少任何已声明路径时 `check-package.mjs` 会直接失败。包仍是起点时保持 `private: true`,只有当 DSH 宿主 peers 通过你打算发布的分发通道可用后再清除它 —— 本包的 npm 发布不是自动化的。

## 测试指引

自带测试证明 Loader 安全的 ESM 导出与 schema 解析后的激活。把激活断言替换为对每个 registry 贡献的可观察行为与销毁断言。`pnpm test` 运行两个 project,因为包的两半需要不同的运行环境:`node` project 覆盖宿主 entry 与 store(无 DOM),`dom` project 在 `jsdom` 中覆盖 React 组件与 hook。`vitest.config.ts` 里的 `#src/*` alias 对应 manifest 的 `imports` 映射 —— 后者只声明了 `.ts`,无法自行解析 `.tsx` 模块。产品可见插件应在消费它的 DSH 应用中添加真实 Loader/profile 组合测试,而不是只依赖手工挂载的单元测试。
