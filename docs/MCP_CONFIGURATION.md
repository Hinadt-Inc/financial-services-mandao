# MCP 配置指南

---

## 问题说明

**现象**：安装 `skills/` 后，Claude Code（或其它 MCP 客户端）没有调用迅信 MCP，而是使用网页搜索或空泛描述。

**原因**：客户端需要通过 `.mcp.json` 注册可用的 MCP 服务器与鉴权；未加载该配置或配置错误时，模型无法发起 `tools/call`。另外，浏览器能上网不代表内网 **SSE URL** 可达。

---

## 解决方案

### 方法 1：自动安装（推荐）

重新运行安装脚本，它会自动创建 `.mcp.json`：

```bash
bash <(curl -sL https://raw.githubusercontent.com/hinadt/financial-services-mandao/main/install_mandao_mcp_financial.sh)
```

### 方法 2：手动配置

如果已经安装了 SKILL，只需要手动创建 .mcp.json 文件：

**Step 1：创建配置文件**

```bash
cat > ~/.claude/.mcp.json << 'EOF'
{
  "mcpServers": {
    "mandao-company": {
      "url": "http://10.254.75.48:8080/mcp/sse",
      "headers": {
        "Authorization": "Bearer ${MANDAO_MCP_API_KEY}"
      },
      "description": "漫道迅信 MCP - 全景指数/综合指数V2/信用探查指数/履约指数"
    }
  }
}
EOF
```

**Step 2：设置 API Key**

```bash
export MANDAO_MCP_API_KEY="your_api_key_here"
```

写入 `~/.zshrc` 或 `~/.bashrc` 可持久化。

**Step 3：重启 Claude Code**

```bash
# 完全退出后再启动
claude
```

---

## 基础信息（备查）

| 项目            | 说明                                                                    |
| --------------- | ----------------------------------------------------------------------- |
| **Server 名称** | `mandao-company`                                                        |
| **MCP URL**     | 由机构提供；示例：`http://10.254.75.48:8080/mcp/sse`                    |
| **协议**        | SSE：`GET` 建连 → `endpoint` 事件获 `POST` 地址 → JSON-RPC `tools/call` |
| **鉴权**        | `Authorization: Bearer <token>`                                         |

**工具与技能目录对应**

| `tools/call` → `name` | 技能目录           | 产品                |
| --------------------- | ------------------ | ------------------- |
| `getXunxinQjdaV130`   | `xunxin-qjda`      | 全景指数 QJDA 1.3.0 |
| `getXunxinZxRadarV2`  | `xunxin-zxradarv2` | 综合指数 V2，2.1.0  |
| `getXunxinQjtzV140`   | `xunxin-qjtz`      | 信用探查 QJTZ 1.4.0 |
| `getXunxinFmlhV140`   | `xunxin-fmlh`      | 履约 FMLH 1.4.0     |

---

## 安装脚本写入的路径（方法 1）

| 目标                                   | 内容                                  |
| -------------------------------------- | ------------------------------------- |
| `~/.claude/.mcp.json`                  | `mandao-company`（覆盖写入前会备份）  |
| `~/.claude/skills/xunxin-`\*           | `SKILL.md` + `reference.md`           |
| `~/.claude/financial-services-mandao/` | `bin/`、`scripts/`、`package.json` 等 |

---

## 验证配置

重启 Claude Code 后：

### 验证方法 1：查看可用工具

在对话或 MCP 面板中应能看到服务器 `**mandao-company`\*\* 及其 4 个工具名。

### 验证方法 2：执行快捷技能

```
/xunxin-fmlh --idNo 110101199001011234 --idName 张三
```

**正确（走 MCP）**：助手说明将调用 `mandao-company` / `getXunxinFmlhV140`（或等价工具调用），并返回结构化业务字段。

**错误（未走 MCP）**：仅「让我搜索一下…」、网页搜索、或无从 MCP 拉取的数据。

### 验证方法 3：CLI（可选）

```bash
mandao init --authorization "Bearer $MANDAO_MCP_API_KEY" --url http://10.254.75.48:8080/mcp/sse
mandao query fmlh --idNo 110101199001011234 --idName 张三
```

---

## 常见问题

**Q：重启后仍没有 MCP？**  
检查 `~/.claude/.mcp.json` 路径与 JSON 语法；确认启动 IDE 的终端里是否已 `export MANDAO_MCP_API_KEY`。

**Q：`data.code` 一直是 `1`？**  
多为查询未命中，不代表接口必坏；需结合业务定义与其它数据源。

**Q：与其它 MCP（如企查查）并存？**  
安装脚本会整文件重写 `.mcp.json`。请从带时间戳的备份中 **合并** `mcpServers` 各节点。

**Q：`Authorization` 能否写「认证码：test」？**  
以网关要求为准；一般应为 `Bearer <纯 token>`。

---

## 工具列表（共 4 个）

> **arguments** 统一：`idNo`、`idName` 必填；`phoneNo` 可选。身份证末位 **X 大写**。报文加密由服务端处理。

### 1) `getXunxinZxRadarV2`

**综合指数 V2**（ZX-RadarV2_1 / 2.1.0）。申请 / 行为 / 信用现状；贷前、定价、贷中监测；建模常看 **KS、AUC**。

| 参数      | 类型   | 说明           |
| --------- | ------ | -------------- |
| `idNo`    | string | 身份证号       |
| `idName`  | string | 姓名           |
| `phoneNo` | string | 手机号（可选） |

### 2) `getXunxinQjdaV130`

**全景指数**（QJDA / 1.3.0）。逾期 + 共债；贷前 / 授信；策略常看击中率、拒绝率、风险提升度等。

| 参数      | 类型   | 说明           |
| --------- | ------ | -------------- |
| `idNo`    | string | 身份证号       |
| `idName`  | string | 姓名           |
| `phoneNo` | string | 手机号（可选） |

### 3) `getXunxinFmlhV140`

**履约指数**（FMLH / 1.4.0）。近期是否履约；贷前快筛。

| 参数      | 类型   | 说明           |
| --------- | ------ | -------------- |
| `idNo`    | string | 身份证号       |
| `idName`  | string | 姓名           |
| `phoneNo` | string | 手机号（可选） |

### 4) `getXunxinQjtzV140`

**信用探查指数**（QJTZ / 1.4.0）。逾期与履约双维度；贷前。

| 参数      | 类型   | 说明           |
| --------- | ------ | -------------- |
| `idNo`    | string | 身份证号       |
| `idName`  | string | 姓名           |
| `phoneNo` | string | 手机号（可选） |
