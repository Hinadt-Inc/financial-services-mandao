# financial-services-mandao · 满道金融风控技能集

> 基于讯信 MCP 实时数据，为消费信贷机构提供贷前风险核查的 AI 工作流技能集与命令行工具。

[![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen.svg)](https://nodejs.org)

> ⚠️ **免责声明**：本技能集提供风险辅助参考，不构成正式授信决策依据。关键业务决策前请结合专业判断与机构内部风控政策。

---

## 产品概览

本项目集成讯信4款风控数据产品，通过 MCP（Model Context Protocol）协议实时获取数据，支持两种使用方式：

- **AI 技能（SKILL）**：在 Claude Code / Cursor 等 AI 编辑器中，通过自然语言指令直接调用
- **命令行工具（CLI）**：`mandao-agent-cli`，在终端中快速查询，无需 AI 环境

| 产品             | 命令                | 适用场景               | 核心维度                              |
| ---------------- | ------------------- | ---------------------- | ------------------------------------- |
| **全景指数**     | `/xunxin-qjda`      | 贷前初筛/授信          | 逾期+共债双维度，近6个月              |
| **综合指数V2**   | `/xunxin-zxradarv2` | 建模/风险定价/贷中监测 | 申请雷达+行为雷达+信用现状，50+字段   |
| **信用探查指数** | `/xunxin-qjtz`      | 贷前审批，正负双向评估 | 四态：有逾期/正常履约/延迟履约/无数据 |
| **履约指数**     | `/xunxin-fmlh`      | 贷前快速黑名单核验     | 两态：有逾期/无数据，成本最低         |

**产品选择建议**：

```
只需快速判断「有无逾期」         → 履约指数 fmlh（成本最低）
需要区分正常/延迟履约            → 信用探查指数 qjtz
需要逾期+共债双维度              → 全景指数 qjda
需要建模或精细化多维度分析        → 综合指数V2 zxradarv2（字段最全）
```

---

## 项目结构

```
financial-services-mandao/
├── skills/                          # AI 技能（供 Claude Code / Cursor 使用）
│   ├── xunxin-qjda/
│   │   ├── SKILL.md                 # 技能定义：工作流、风险定级、输出模板
│   │   └── reference.md             # 完整字段参考（开发者文档）
│   ├── xunxin-zxradarv2/
│   │   ├── SKILL.md
│   │   └── reference.md
│   ├── xunxin-qjtz/
│   │   ├── SKILL.md
│   │   └── reference.md
│   └── xunxin-fmlh/
│       ├── SKILL.md
│       └── reference.md
├── bin/
│   └── mandao.js                    # CLI 入口（mandao-agent-cli）
├── .mcp.json                        # MCP Server 配置（Cursor 自动加载）
└── package.json
```

---

## 快速开始

### 方式一：AI 技能（推荐，Claude Code / Cursor）

**Step 1：配置 MCP**

编辑项目根目录的 `.mcp.json`，填入认证码：

```json
{
  "mcpServers": {
    "mandao-company": {
      "url": "http://10.254.75.48:8080/mcp/sse",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

**Step 2：在 AI 对话中加载技能**

告诉 AI 加载本项目（以 GitHub 地址或本地路径均可）：

```
请加载并使用这个项目中的技能：xxxxx
```

**Step 3：直接使用**

```
/xunxin-qjda --idNo 110101199001011234 --idName 张三 --phoneNo 13800138000

/xunxin-zxradarv2 --idNo 110101199001011234 --idName 张三

/xunxin-qjtz --idNo 110101199001011234 --idName 张三

/xunxin-fmlh --idNo 110101199001011234 --idName 张三
```

---

### 方式二：命令行工具（mandao-agent-cli）

**安装**

```bash
npm install -g mandao-agent-cli
```

**初始化（只需一次）**

```bash
mandao init --authorization "Bearer YOUR_API_KEY"

# 或指定自定义 MCP 地址
mandao init --authorization "Bearer YOUR_API_KEY" --url http://10.254.75.48:8080/mcp/sse
```

配置保存到 `~/.mandao/config.json`，后续无需重复配置。

**查询示例**

```bash
# 全景指数（逾期+共债）
mandao query qjda --idNo 110101199001011234 --idName 张三 --phoneNo 13800138000

# 综合指数V2（建模三报告）
mandao query zxradarv2 --idNo 110101199001011234 --idName 张三

# 信用探查指数（四态判断）
mandao query qjtz --idNo 110101199001011234 --idName 张三

# 履约指数（快速初筛）
mandao query fmlh --idNo 110101199001011234 --idName 张三
```

**可选参数**

| 参数        | 说明                                             |
| ----------- | ------------------------------------------------ |
| `--phoneNo` | 手机号（可选，提升命中率）                       |
| `--json`    | 只输出原始 JSON，不做格式化（适合管道/脚本集成） |
| `--verbose` | 格式化输出 + 附带完整原始 JSON                   |

**其他命令**

```bash
mandao config show   # 查看当前配置
mandao --help        # 帮助信息
```

---

## 风险评估说明

### 通用响应码

| `data.code` | 含义                                | 是否收费 |
| ----------- | ----------------------------------- | -------- |
| `0`         | 查询命中，`result_detail` 有数据    | Y        |
| `1`         | 查询未命中，`result_detail` 为 null | N        |
| `9`         | 系统异常                            | —        |

> `code=1`（未命中）≠ 无风险，可能是该用户无三方支付借贷记录，建议配合央行征信综合判断。

### 各产品风险等级

**全景指数 / 信用探查指数 / 履约指数**

| 等级        | 触发条件                                            | 准入建议       |
| ----------- | --------------------------------------------------- | -------------- |
| 🔴 高风险   | 当前未结清逾期 / 借新还旧 / `currently_overdue ≥ 2` | 拒绝           |
| 🟠 中高风险 | 多机构逾期 / 近期逾期较重                           | 人工复核       |
| 🟡 中风险   | 历史逾期已结清 / 轻度延迟履约                       | 审慎准入，降额 |
| 🟢 低风险   | 正常履约 / 无逾期记录                               | 正常准入       |

**综合指数V2**

| 等级        | 申请准入分 A22160001 | 准入建议 |
| ----------- | -------------------- | -------- |
| 🔴 高风险   | < 400                | 拒绝     |
| 🟠 中高风险 | 400–500              | 人工复核 |
| 🟡 中风险   | 500–600              | 审慎准入 |
| 🟢 低风险   | > 600                | 正常准入 |

---

## MCP 接入说明

**MCP Server 信息**

| 项目        | 值                                 |
| ----------- | ---------------------------------- |
| Server 名称 | `mandao-company`                   |
| SSE URL     | `http://10.254.75.48:8080/mcp/sse` |
| 协议        | MCP SSE（JSON-RPC 2.0）            |

**工具列表**

| 工具名               | 产品                          | 入参                          |
| -------------------- | ----------------------------- | ----------------------------- |
| `getXunxinQjdaV130`  | 全景指数 QJDA 1.3.0           | `idNo` / `idName` / `phoneNo` |
| `getXunxinZxRadarV2` | 综合指数V2 ZX-RadarV2_1 2.1.0 | `idNo` / `idName` / `phoneNo` |
| `getXunxinQjtzV140`  | 信用探查指数 QJTZ 1.4.0       | `idNo` / `idName` / `phoneNo` |
| `getXunxinFmlhV140`  | 履约指数 FMLH 1.4.0           | `idNo` / `idName` / `phoneNo` |

> 所有工具入参传明文，MCP 内部自动完成 MD5/SHA256/SM3 加密和报文封装。身份证末位含 X 时须大写。

详细字段说明见 [docs/mcp.md](docs/mcp.md) 及各产品 `reference.md`。

---

## 开发说明

### 环境要求

- Node.js >= 20（CLI 使用内置 `fetch`，无需额外依赖）

### 本地运行（无需全局安装）

```bash
# 克隆项目
git clone <repo-url>
cd financial-services-mandao

# 直接运行
node bin/mandao.js init --authorization "Bearer YOUR_API_KEY"
node bin/mandao.js query qjda --idNo 110101199001011234 --idName 张三
```

---

## 许可证

[Apache License 2.0](LICENSE)
