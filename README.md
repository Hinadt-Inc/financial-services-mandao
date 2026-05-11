# Financial Services Mandao — 漫道 MCP 技能集

> 基于MCP 实时数据，为消费信贷、互金风控提供 **贷前个人主体** 风险核查的 AI 工作流技能与命令行工具。

[![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-mandao--company-orange.svg)](./docs/MCP_CONFIGURATION.md)
[![Claude](https://img.shields.io/badge/Claude%20Code-Compatible-purple.svg)](https://claude.ai)

> ⚠️ **免责声明**：本技能集提供工作流辅助，不构成正式授信审批、法律意见或合规报送结论。关键决策前请结合专业判断、机构风控政策与人工复核。

---

## 4 个技能总览

### 核心分析（2 个）

| 技能            | 命令              | 目标用户                      | 核心场景                                   | 耗时      |
| --------------- | ----------------- | ----------------------------- | ------------------------------------------ | --------- |
| **全景指数**    | `/risk-qjda`      | 信贷审批、授信初筛            | 近 6 个月逾期明细 + 共债（含借新还旧信号） | ~10–60 秒 |
| **综合指数 V2** | `/risk-zxradarv2` | 策略/建模、风险定价、贷中监测 | 申请雷达 + 行为雷达 + 信用现状，50+ 指标   | ~10–60 秒 |

### 探查与快筛（2 个）

| 技能             | 命令         | 目标用户             | 核心场景                                  | 耗时      |
| ---------------- | ------------ | -------------------- | ----------------------------------------- | --------- |
| **信用探查指数** | `/risk-qjtz` | 贷前审批             | 逾期与履约双维度，四态（含正常/延迟履约） | ~10–60 秒 |
| **履约指数**     | `/risk-fmlh` | 贷前快筛、黑名单初筛 | 仅判断是否逾期 vs 无数据，成本最低        | ~10–60 秒 |

**选型提示**

```
只需快速判断「有无逾期」     → /risk-fmlh
需要区分正常 / 延迟履约      → /risk-qjtz
需要逾期 + 共债双维度        → /risk-qjda
需要入模 / 全链路多维分析    → /risk-zxradarv2
```

---

## MCP 集成

所有技能通过 **1 个** MCP Server 获取封装数据；客户端侧通常注册为 **`mandao-company`**（与根目录 `.mcp.json` 一致）。

| Server           | 说明                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `mandao-company` | HTTP **SSE** + JSON-RPC `tools/call`；鉴权见 `Authorization`；对 API 的加密封装由服务端完成 |

**技能与 MCP 工具对应**

| 技能                          | `mandao-company` 工具名 |
| ----------------------------- | ----------------------- |
| 全景指数 `/risk-qjda`         | `getRiskXQjdaV130`      |
| 综合指数 V2 `/risk-zxradarv2` | `getRiskZxRadarV2`      |
| 信用探查 `/risk-qjtz`         | `getRiskQjtzV140`       |
| 履约指数 `/risk-fmlh`         | `getRiskFmlhV140`       |

---

## 快速开始

### 第一步：申请 MCP Key 与接入地址

向 [智能体数据平台](https://agent.hinadt.com/) 获取 **API Key**，并确认 **SSE URL**（示例见 [MCP 配置指南](./docs/MCP_CONFIGURATION.md)）。

### 第二步：一键安装

```bash
git clone https://github.com/Hinadt-Inc/financial-services-mandao.git
cd financial-services-mandao
export MANDAO_MCP_API_KEY="your_api_key_here"
bash install_mandao_mcp_financial.sh
```

### 第三步：重启 Claude Code（必须）

完全退出并重新启动 Claude Code，MCP 配置才会生效。

### 第四步：开始使用

```bash
# 全景指数（逾期 + 共债）
/risk-qjda --idNo 110101199001011234 --idName 张三 --phoneNo 13800138000

# 综合指数 V2（申请 / 行为 / 信用现状）
/risk-zxradarv2 --idNo 110101199001011234 --idName 张三

# 信用探查（四态）
/risk-qjtz --idNo 110101199001011234 --idName 张三

# 履约快筛（两态）
/risk-fmlh --idNo 110101199001011234 --idName 张三
```

> **验证 MCP 是否生效**：执行后应出现对 **`mandao-company`** 下工具的调用（如 `getRiskXQjdaV130`），而不是仅「网页搜索」。

---

## 快速命令参考

| 命令              | 功能                           | 典型耗时  | 输出格式                          |
| ----------------- | ------------------------------ | --------- | --------------------------------- |
| `/risk-qjda`      | 全景指数 QJDA 1.3.0            | ~10–60 秒 | Markdown（见 SKILL，可扩展 docx） |
| `/risk-zxradarv2` | 综合指数 V2 ZX-RadarV2_1 2.1.0 | ~10–60 秒 | Markdown（三子报告结构）          |
| `/risk-qjtz`      | 信用探查 QJTZ 1.4.0            | ~10–60 秒 | Markdown                          |
| `/risk-fmlh`      | 履约 FMLH 1.4.0                | ~10–60 秒 | Markdown                          |

详见 [MCP 配置指南](./docs/MCP_CONFIGURATION.md)

---

## 技能详解

### 1. 全景指数 · `risk-qjda`

**适用对象**：信贷审批、贷前运营、风控策略（击中率 / 拒绝率 / 风险提升度）

**核心价值**：近 6 个月逾期结构 + 共债（含 `new_or_old` 借新还旧疑似）。

**MCP**：`mcp__mandao-company__getRiskXQjdaV130`

```bash
/risk-qjda --idNo <身份证> --idName <姓名> [--phoneNo <手机号>] [--format md]
```

---

### 2. 综合指数 V2 · `risk-zxradarv2`

**适用对象**：策略与模型、授信定价、贷中监测（KS / AUC）

**核心价值**：申请雷达 + 行为雷达 + 信用现状，字段最全。

**MCP**：`mcp__mandao-company__getRiskZxRadarV2`

```bash
/risk-zxradarv2 --idNo <身份证> --idName <姓名> [--phoneNo <手机号>] [--format md]
```

---

### 3. 信用探查指数 · `risk-qjtz`

**适用对象**：贷前审批、需正负双向（逾期 + 履约）画像

**核心价值**：`result_code` 四态；含履约向字段（FMLH 不覆盖）。

**MCP**：`mcp__mandao-company__getRiskQjtzV140`

```bash
/risk-qjtz --idNo <身份证> --idName <姓名> [--phoneNo <手机号>] [--format md]
```

---

### 4. 履约指数 · `risk-fmlh`

**适用对象**：高并发初筛、仅需是否逾期命中

**核心价值**：两态（有逾期 / 无数据）；与 QJTZ 差异见对应 `SKILL.md`。

**MCP**：`mcp__mandao-company__getRiskFmlhV140`

```bash
/risk-fmlh --idNo <身份证> --idName <姓名> [--phoneNo <手机号>] [--format md]
```

---

## 典型使用场景

### 消费信贷贷前进件

```
收到身份证 + 姓名
→ /risk-fmlh 快速命中
→ 未排除则 /risk-qjtz 或 /risk-qjda（共债 / 双维度）
→ 需定价或建模特征时 /risk-zxradarv2
```

### 策略与报表

```
/risk-zxradarv2 拉取多轨行为与申请字段
→ 与机构自有标签计算 KS/AUC（阈值须用本机构样本标定）
```

---

## 命令行工具（mandao-agent-cli）

不依赖 Claude 时，可使用 **Node.js ≥ 20** 与 `bin/mandao.js`（`package.json` 中 `bin: mandao`）。

```bash
npm install -g mandao-agent-cli
mandao init --authorization "Bearer YOUR_API_KEY" --url https://agent.hinadt.com/mcp
mandao query qjda|zxradarv2|qjtz|fmlh --idNo … --idName … [--phoneNo …] [--json] [--verbose]
mandao config show
```

本地：`node bin/mandao.js …`（同上子命令）。

---

## 业务结果码（摘要）

| `data.code` | 含义                       | 计费（以合同为准） |
| ----------- | -------------------------- | ------------------ |
| `0`         | 命中，`result_detail` 有值 | 通常收费           |
| `1`         | 未命中                     | 通常不收费         |
| `9`         | 其它异常                   | —                  |

`code=1` 不代表客户无风险。细节见各 `skills/*/reference.md`。

---

## 项目结构

```
financial-services-mandao/
├── README.md
├── docs/
│   └── MCP_CONFIGURATION.md      # MCP 问题排查、安装、验证、工具契约（对齐 QCC 文档职责）
├── install_mandao_mcp_financial.sh
├── .mcp.json
├── package.json
├── bin/mandao.js
├── scripts/                      # 可选：历史单品脚本
└── skills/
    └── risk-*/                 # SKILL.md + reference.md
```

---

## 术语对照

| 缩写               | 含义                       |
| ------------------ | -------------------------- |
| MCP                | Model Context Protocol     |
| SSE                | Server-Sent Events         |
| QJDA / QJTZ / FMLH | 产品编码                   |
| ZX-RadarV2_1       | 综合指数 V2 产品标识       |
| KS / AUC           | 区分度指标（综合指数场景） |

---

## 文档与支持

- **MCP 安装与排障**：[docs/MCP_CONFIGURATION.md](./docs/MCP_CONFIGURATION.md)
- **工作流与评级逻辑**：`skills/*/SKILL.md`
- **字段级说明**：`skills/*/reference.md`

---

## 许可证

[Apache License 2.0](LICENSE)
