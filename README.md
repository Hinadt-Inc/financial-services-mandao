# Financial Services Mandao — 漫道讯信 MCP 消费信贷技能集

> 基于讯信（Xunxin）MCP 实时数据，为消费信贷、互金风控提供 **贷前个人主体** 风险核查的 AI 工作流技能与命令行工具。

[![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-mandao--company-blue.svg)](#mcp-配置指南)

> ⚠️ **免责声明**：本技能集提供工作流与数据辅助，不构成正式授信审批、法律意见或监管报送结论。关键决策须结合机构风控政策与人工复核。

---

## 4 个技能总览

| 技能             | 命令                | 目标用户                      | 核心场景                                   | 典型耗时  |
| ---------------- | ------------------- | ----------------------------- | ------------------------------------------ | --------- |
| **全景指数**     | `/xunxin-qjda`      | 信贷审批、授信初筛            | 近 6 个月逾期明细 + 共债（含借新还旧信号） | ~10–60 秒 |
| **综合指数 V2**  | `/xunxin-zxradarv2` | 策略/建模、风险定价、贷中监测 | 行为 + 申请 + 信用现状，50+ 指标           | ~10–60 秒 |
| **信用探查指数** | `/xunxin-qjtz`      | 贷前审批                      | 逾期与履约双维度，四态（含正常/延迟履约）  | ~10–60 秒 |
| **履约指数**     | `/xunxin-fmlh`      | 贷前快筛、黑名单初筛          | 仅判断是否逾期 vs 无数据，成本最低         | ~10–60 秒 |

**选型提示**

```
只需快速判断「有无逾期」     → /xunxin-fmlh（履约指数）
需要区分正常 / 延迟履约      → /xunxin-qjtz（信用探查）
需要逾期 + 共债双维度        → /xunxin-qjda（全景指数）
需要入模 / 全链路多维分析    → /xunxin-zxradarv2（综合指数 V2）
```

---

## 讯信 MCP 集成

所有技能通过 **1 个** MCP Server 调用讯信封装后的工具，在客户端侧通常注册名为 `mandao-company`（与仓库根目录 `.mcp.json` 一致）。

| Server           | 传输                                 | 说明                                                   |
| ---------------- | ------------------------------------ | ------------------------------------------------------ |
| `mandao-company` | HTTP **SSE** + JSON-RPC `tools/call` | 鉴权在 `Authorization`；对讯信侧的加密封装由服务端完成 |

| 技能                            | MCP 工具名 (`tools/call` → `name`) |
| ------------------------------- | ---------------------------------- |
| 全景指数 `/xunxin-qjda`         | `getXunxinQjdaV130`                |
| 综合指数 V2 `/xunxin-zxradarv2` | `getXunxinZxRadarV2`               |
| 信用探查 `/xunxin-qjtz`         | `getXunxinQjtzV140`                |
| 履约指数 `/xunxin-fmlh`         | `getXunxinFmlhV140`                |

---

## MCP 配置指南

本节对齐 [financial-services-qcc 的 MCP 配置说明](https://github.com/duhu2000/financial-services-qcc/blob/main/docs/MCP_CONFIGURATION.md) 的用途：**现象排查 → 怎么配 → 怎么验证 → 常见问题 → 工具契约**。字段级字典在各技能目录 `reference.md`。

### 问题说明

**现象**：已放 `skills/`，对话里 AI 不调 MCP，只泛泛描述或网页搜索。

**常见原因**

1. 客户端未加载 MCP：无项目根 `.mcp.json`，或 Claude Code 未用 `~/.claude/.mcp.json`。
2. 修改配置后 **未完全重启** MCP 宿主（Claude Code / IDE）。
3. `Authorization` 未配置，或 JSON 里占位符与环境变量名不一致（如应为 `MANDAO_MCP_API_KEY`）。
4. 网络：`SSE URL` 多为内网，本机能上网不等于能连网关。

### 配置示例

**Cursor / 项目根 `.mcp.json`**（将 `YOUR_API_KEY` 换成真实 Token；URL 以环境为准）

```json
{
  "mcpServers": {
    "mandao-company": {
      "url": "http://10.254.75.48:8080/mcp/sse",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      },
      "description": "满道讯信 MCP — 全景/综合V2/探查/履约"
    }
  }
}
```

**Claude Code：`~/.claude/.mcp.json`**（推荐：Token 用环境变量，不写进仓库）

一键安装脚本写入的典型形态：

```json
{
  "mcpServers": {
    "mandao-company": {
      "url": "http://10.254.75.48:8080/mcp/sse",
      "headers": {
        "Authorization": "Bearer ${MANDAO_MCP_API_KEY}"
      },
      "description": "满道讯信MCP - 全景指数/综合指数V2/信用探查指数/履约指数"
    }
  }
}
```

启动前在同一终端执行：

```bash
export MANDAO_MCP_API_KEY="your_real_token"
# 若安装时要改默认地址：
# export MANDAO_MCP_SSE_URL="http://你的主机:端口/mcp/sse"
```

### 安装脚本写入的路径

执行 **`install_mandao_mcp_financial.sh`** 后概要：

| 目标                                   | 内容                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `~/.claude/.mcp.json`                  | `mandao-company`（**整文件覆盖**，会先备份；与其它 MCP 并存时需自行合并） |
| `~/.claude/skills/xunxin-*`            | 各技能 `SKILL.md` + `reference.md`                                        |
| `~/.claude/financial-services-mandao/` | `bin/`、`scripts/`、`package.json` 等，便于本地跑 CLI                     |

### 验证配置

1. IDE：工具列表或 MCP 面板中出现 **`mandao-company`**。
2. 对话：执行 `/xunxin-fmlh --idNo … --idName …`，应看到对 **`getXunxinFmlhV140`**（或同 Server 工具）的调用，而不是纯网页搜索。
3. CLI（可选）：

```bash
mandao init --authorization "Bearer $MANDAO_MCP_API_KEY" --url http://10.254.75.48:8080/mcp/sse
mandao query fmlh --idNo 110101199001011234 --idName 张三
```

### 常见问题

| 问题                       | 说明                                                                              |
| -------------------------- | --------------------------------------------------------------------------------- |
| `data.code` 一直为 `1`     | 多为**未命中**，不一定代表接口故障；须结合合同与其它数据源。                      |
| 装完只剩满道、企查查不见了 | 安装脚本会**重写** `~/.claude/.mcp.json`，请从带时间戳的备份里合并 `mcpServers`。 |
| `Authorization` 怎么写     | 一般为 `Bearer <token>`；具体以网关/讯信交付为准，勿把说明性文字写进 Header。     |

### 工具列表（共 4 个）

> 四个工具的 **arguments** 一致：`idNo`、`idName` 必填；`phoneNo` 选填（利于命中）。身份证末位 **X 须大写**。报文加密由 MCP 服务端处理。

#### 1) `getXunxinZxRadarV2`

**讯信-综合指数 V2**（ZX-RadarV2_1 / 2.1.0）。刻画申请、借贷行为与信用现状；适用于贷前审批、风险定价、授信与贷中监测；建模场景常看 **KS、AUC**。

| 参数      | 类型   | 说明           |
| --------- | ------ | -------------- |
| `idNo`    | string | 身份证号       |
| `idName`  | string | 姓名           |
| `phoneNo` | string | 手机号（可选） |

#### 2) `getXunxinQjdaV130`

**讯信-全景指数**（QJDA / 1.3.0）。逾期 + 共债等；适用于贷前申请、授信；策略侧常看击中率、拒绝率、风险提升度等。

| 参数      | 类型   | 说明           |
| --------- | ------ | -------------- |
| `idNo`    | string | 身份证号       |
| `idName`  | string | 姓名           |
| `phoneNo` | string | 手机号（可选） |

#### 3) `getXunxinFmlhV140`

**讯信-履约指数**（FMLH / 1.4.0）。近期是否履约；适用于贷前；策略侧常看击中率、拒绝率、风险提升度等。

| 参数      | 类型   | 说明           |
| --------- | ------ | -------------- |
| `idNo`    | string | 身份证号       |
| `idName`  | string | 姓名           |
| `phoneNo` | string | 手机号（可选） |

#### 4) `getXunxinQjtzV140`

**讯信-信用探查指数**（QJTZ / 1.4.0）。逾期与履约双维度；适用于贷前；策略侧常看击中率、拒绝率、风险提升度等。

| 参数      | 类型   | 说明           |
| --------- | ------ | -------------- |
| `idNo`    | string | 身份证号       |
| `idName`  | string | 姓名           |
| `phoneNo` | string | 手机号（可选） |

---

## 快速开始

### 第一步：获取 MCP 地址与 Token

向讯信 / 本机构运维获取 **SSE URL** 与 **Bearer Token**（示例 URL 见上文 JSON，以实际为准）。

### 第二步：一键安装（推荐，Claude Code）

```bash
git clone <your-repo-url>/financial-services-mandao.git
cd financial-services-mandao

export MANDAO_MCP_API_KEY="your_token_here"

bash install_mandao_mcp_financial.sh
```

**仅用 Cursor 打开本仓库**：可直接编辑根目录 `.mcp.json`，或把 `Authorization` 写成 `Bearer ${MANDAO_MCP_API_KEY}` 并在启动前 `export`。

### 第三步：重启 MCP 客户端（必须）

完全退出并重新打开 Claude Code（或当前 IDE），新 MCP 才会加载。

### 第四步：开始使用

加载本仓库后（Git URL 或本机路径），示例：

```bash
/xunxin-qjda --idNo 110101199001011234 --idName 张三 --phoneNo 13800138000
/xunxin-zxradarv2 --idNo 110101199001011234 --idName 张三
/xunxin-qjtz --idNo 110101199001011234 --idName 张三
/xunxin-fmlh --idNo 110101199001011234 --idName 张三
```

> **验证**：应答里应出现 **`mandao-company`** 下工具调用（如 `getXunxinQjdaV130`），而非仅网页搜索。

---

## 快速命令参考

| 命令                | 功能                           |
| ------------------- | ------------------------------ |
| `/xunxin-qjda`      | 全景指数 QJDA 1.3.0            |
| `/xunxin-zxradarv2` | 综合指数 V2 ZX-RadarV2_1 2.1.0 |
| `/xunxin-qjtz`      | 信用探查 QJTZ 1.4.0            |
| `/xunxin-fmlh`      | 履约 FMLH 1.4.0                |

输出结构、风险定级与报告章节以各 `skills/*/SKILL.md` 为准。

---

## 技能详解

### 1. 全景指数 · `xunxin-qjda`

**适用对象**：信贷审批、贷前运营、风控策略（击中率 / 拒绝率 / 风险提升度）

**核心价值**：近 6 个月逾期结构 + 共债（含 `new_or_old` 借新还旧疑似）。

**MCP 工具**：`mcp__mandao-company__getXunxinQjdaV130`

```bash
/xunxin-qjda --idNo <身份证> --idName <姓名> [--phoneNo <手机号>] [--format md]
```

### 2. 综合指数 V2 · `xunxin-zxradarv2`

**适用对象**：策略与模型、授信定价、贷中监测（KS / AUC）

**核心价值**：申请雷达 + 行为雷达 + 信用现状，字段最全。

**MCP 工具**：`mcp__mandao-company__getXunxinZxRadarV2`

```bash
/xunxin-zxradarv2 --idNo <身份证> --idName <姓名> [--phoneNo <手机号>] [--format md]
```

### 3. 信用探查指数 · `xunxin-qjtz`

**适用对象**：贷前审批、需正负双向（逾期 + 履约）画像

**核心价值**：`result_code` 四态；含履约向字段（FMLH 不覆盖）。

**MCP 工具**：`mcp__mandao-company__getXunxinQjtzV140`

```bash
/xunxin-qjtz --idNo <身份证> --idName <姓名> [--phoneNo <手机号>] [--format md]
```

### 4. 履约指数 · `xunxin-fmlh`

**适用对象**：高并发初筛、仅需是否逾期命中

**核心价值**：两态（有逾期 / 无数据），与 QJTZ 差异见对应 `SKILL.md`。

**MCP 工具**：`mcp__mandao-company__getXunxinFmlhV140`

```bash
/xunxin-fmlh --idNo <身份证> --idName <姓名> [--phoneNo <手机号>] [--format md]
```

---

## 典型使用场景

### 场景 A：线上进件 → 先快筛再详查

```
进件（身份证 + 姓名）
  → /xunxin-fmlh
  → /xunxin-qjtz 或 /xunxin-qjda
  → /xunxin-zxradarv2（定价 / 建模特征）
```

### 场景 B：策略迭代

```
/xunxin-zxradarv2 拉全量多轨指标 → 与机构标签算 KS/AUC（阈值须本机构样本标定）
```

---

## 命令行工具（mandao-agent-cli）

依赖 **Node.js ≥ 20**（内置 `fetch`），入口为 `bin/mandao.js`。

```bash
npm install -g mandao-agent-cli

mandao init --authorization "Bearer YOUR_API_KEY" --url http://10.254.75.48:8080/mcp/sse

mandao query qjda|zxradarv2|qjtz|fmlh --idNo … --idName … [--phoneNo …] [--json] [--verbose]
mandao config show
```

本地：

```bash
node bin/mandao.js init --authorization "Bearer YOUR_API_KEY" --url <sse-url>
node bin/mandao.js query qjda --idNo … --idName …
```

---

## 业务结果码（摘要）

| `data.code` | 含义                         | 计费（以合同为准） |
| ----------- | ---------------------------- | ------------------ |
| `0`         | 命中，`result_detail` 有值   | 通常收费           |
| `1`         | 未命中，`result_detail` 为空 | 通常不收费         |
| `9`         | 其它异常                     | —                  |

`code=1` **不等于** 无风险，可能只是该主体在覆盖数据源中无记录。细节见各 `skills/*/reference.md`。

---

## 项目结构

```
financial-services-mandao/
├── install_mandao_mcp_financial.sh
├── README.md                         # 本文件：技能 + MCP 配置（原 docs/mcp.md 已并入）
├── .mcp.json
├── package.json
├── bin/mandao.js
├── scripts/                          # 历史单品脚本 + lib/（可选）
└── skills/
    └── xunxin-*/                     # SKILL.md + reference.md
```

> 若你仍会删除整个 `docs/` 目录：**请先将其中讯信 Word 接口说明自行备份**；本 README 与 `reference.md` 已覆盖日常配置与字段摘要，不依赖 `docs/`。

---

## 术语对照

| 缩写               | 含义                       |
| ------------------ | -------------------------- |
| MCP                | Model Context Protocol     |
| SSE                | Server-Sent Events         |
| QJDA / QJTZ / FMLH | 讯信产品编码               |
| ZX-RadarV2_1       | 综合指数 V2 产品标识       |
| KS / AUC           | 区分度指标（综合指数场景） |

---

## 支持资源

- **工作流与定级**：`skills/*/SKILL.md`
- **字段表与示例**：`skills/*/reference.md`

---

## 许可证

[Apache License 2.0](LICENSE)
