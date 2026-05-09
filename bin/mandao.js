#!/usr/bin/env node
/**
 * mandao-agent-cli
 * 漫道金融风控 MCP 命令行工具
 *
 * 安装：npm install -g mandao-agent-cli
 *
 * 初始化：
 *   mandao init --authorization "Bearer YOUR_API_KEY"
 *   mandao init --authorization "Bearer YOUR_API_KEY" --url https://agent.hinadt.com/mcp
 *
 * 查询：
 *   mandao query qjda      --idNo <身份证> --idName <姓名> [--phoneNo <手机号>] [--json] [--verbose]
 *   mandao query zxradarv2 --idNo <身份证> --idName <姓名> [--phoneNo <手机号>] [--json] [--verbose]
 *   mandao query qjtz      --idNo <身份证> --idName <姓名> [--phoneNo <手机号>] [--json] [--verbose]
 *   mandao query fmlh      --idNo <身份证> --idName <姓名> [--phoneNo <手机号>] [--json] [--verbose]
 *
 * 其他：
 *   mandao config show     显示当前配置
 *   mandao --help
 *
 * 要求：Node.js >= 20（使用内置 fetch）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─────────────────────────────────────────────
// 配置管理
// ─────────────────────────────────────────────

const CONFIG_DIR = path.join(os.homedir(), '.mandao');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_URL = 'https://agent.hinadt.com/mcp';

function loadConfig () {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function saveConfig (cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}
// 检查配置是否存在
function requireConfig () {
  const cfg = loadConfig();
  if (!cfg || !cfg.authorization) {
    console.error('错误：未初始化，请先执行：');
    console.error('  mandao init --authorization "Bearer YOUR_API_KEY"');
    process.exit(1);
  }
  return cfg;
}

// ─────────────────────────────────────────────
// 参数解析
// ─────────────────────────────────────────────

function parseArgs (argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(argv[i]);
    }
  }
  return args;
}

// ─────────────────────────────────────────────
// MCP SSE 客户端（内置 fetch，Node.js >= 20）
// ─────────────────────────────────────────────

/**
 * 从 SSE 文本缓冲区中解析完整事件。
 * 事件之间以 \n\n 分隔，未凑成完整事件的内容保留在 remaining 中。
 */
function parseSseBuffer (buffer) {
  const events = [];
  let pos = 0;

  while (true) {
    const end = buffer.indexOf('\n\n', pos);
    if (end === -1) break;

    const block = buffer.slice(pos, end);
    pos = end + 2;
    if (!block.trim()) continue;

    let event = 'message';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (data) events.push({ event, data });
  }

  return { events, remaining: buffer.slice(pos) };
}

/**
 * 通过 MCP SSE 协议调用工具。
 *
 * 协议流程（符合 MCP 2024-11-05 规范）：
 *   1. GET /mcp/sse          建立 SSE 流，等待 `endpoint` 事件取得 POST 地址
 *   2. POST initialize       MCP 握手初始化，等待响应
 *   3. POST notifications/initialized  通知服务端握手完成
 *   4. POST tools/call       发送工具调用，从 SSE 流读取响应
 *
 * @param {string} toolName
 * @param {object} toolArgs
 * @param {object} cfg        { authorization, url }
 * @param {number} [timeout]
 * @returns {Promise<any>}
 */
async function callMcpTool (toolName, toolArgs, cfg, timeout = 30000) {
  const sseUrl = cfg.url || DEFAULT_URL;
  const authHeader = cfg.authorization;
  // 使用递增整数 id 方便匹配
  const INIT_ID = 1;
  const TOOL_ID = 2;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`MCP 调用超时 (${timeout}ms): ${toolName}`)),
    timeout,
  );
  // 向 endpoint POST 一条 JSON-RPC 消息，fire-and-forget（响应通过 SSE 回来）
  async function postMessage (epUrl, payload) {
    const body = JSON.stringify(payload);
    const res = await fetch(epUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`POST 失败 HTTP ${res.status}: ${text}`);
    }
  }
  try {
    // 
    const sseRes = await fetch(sseUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Authorization: authHeader,
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    if (!sseRes.ok) throw new Error(`SSE 连接失败，HTTP ${sseRes.status}`);
    if (!sseRes.body) throw new Error('SSE 响应无可读流');

    const reader = sseRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let epUrl = null;        // POST 地址，从 endpoint 事件获取
    let initDone = false;    // initialize 握手是否完成

    while (true) {
      const { done, value } = await reader.read();
      if (done) throw new Error('SSE 连接意外关闭');

      buffer += decoder.decode(value, { stream: true });
      const { events, remaining } = parseSseBuffer(buffer);
      buffer = remaining;
      for (const { event, data } of events) {
        // ① endpoint 事件 → 发 initialize 握手 告诉服务器：我用的是哪个协议版本（2024-11-05）、我是谁（clientInfo）。
        if (event === 'endpoint' && !epUrl) {
          epUrl = new URL(data.trim(), sseUrl).toString();
          postMessage(epUrl, {
            jsonrpc: '2.0',
            id: INIT_ID,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: { name: 'mandao-cli', version: '1.0.0' },
            },
          }).catch((e) => controller.abort(e));
        }

        // ② message 事件
        if (event === 'message') {
          let msg;
          try { msg = JSON.parse(data); } catch { continue; }

          // initialize 响应 → 发 initialized 通知 + tools/call
          if (msg.id === INIT_ID && !initDone) {
            if (msg.error) throw new Error(`initialize 失败: ${msg.error.message}`);
            initDone = true;

            // notifications/initialized 无需等待响应
            postMessage(epUrl, { jsonrpc: '2.0', method: 'notifications/initialized', params: {} })
              .catch(() => { });

            // 发送真正的工具调用
            postMessage(epUrl, {
              jsonrpc: '2.0',
              id: TOOL_ID,
              method: 'tools/call',
              params: { name: toolName, arguments: toolArgs },
            }).catch((e) => controller.abort(e));
          }

          // tools/call 响应
          if (msg.id === TOOL_ID) {
            reader.cancel();
            clearTimeout(timer);
            if (msg.error) {
              throw new Error(`MCP 错误 [${msg.error.code}]: ${msg.error.message}`);
            }
            return msg.result;
          }
        }
      }
    }
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw err.cause ?? new Error(`MCP 调用超时 (${timeout}ms): ${toolName}`);
    }
    if (err.cause) {
      const cause = err.cause;
      throw new Error(`${err.message}（原因: ${cause.code ?? cause.message ?? cause}）`);
    }
    throw err;
  }
}

// ─────────────────────────────────────────────
// 结果解析工具
// ─────────────────────────────────────────────

function extractBizData (mcpResult) {
  const raw = mcpResult?.content?.[0]?.text ?? JSON.stringify(mcpResult);
  const parsed = JSON.parse(raw);
  if (!parsed.success) {
    throw new Error(`接口错误 [${parsed.errorCode}]: ${parsed.errorMsg}`);
  }
  return parsed.data;
}

// ─────────────────────────────────────────────
// 格式化输出：各产品
// ─────────────────────────────────────────────

function printHeader (title, options) {
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(56)}`);
  const phoneStr = options.phoneNo ? `  手机号: ${options.phoneNo}` : '';
  console.log(`  身份证: ${options.idNo}  姓名: ${options.idName}${phoneStr}`);
  console.log(`${'─'.repeat(56)}`);
}

function printBizMeta (d) {
  const { code, desc, fee } = d
  const feeStr = {
    Y: '收费(Y)',
    N: '免费(N)',
  }[fee] || fee;
  console.log(`  响应码: ${code} (${desc})   是否收费: ${feeStr}`);
}

/* ── 全景指数 QJDA ── */
function printQjda (d) {
  printBizMeta(d);
  const { code, results } = d
  if (code !== '0' || !results?.result_detail) {
    console.log('\n  未命中，无结果数据。');
    return;
  }
  const r = results.result_detail;

  console.log('\n  ┌ 逾期概况（近6个月）');
  console.log(`  │  逾期机构数: ${r.member_count ?? '-'}   逾期订单数: ${r.order_count ?? '-'}   逾期总金额: ${r.debt_amount ?? '-'} 元`);

  console.log('\n  ├ 逾期明细');
  if (!r.debt_detail?.length) {
    console.log('  │  （无逾期记录）');
  } else {
    r.debt_detail.forEach((x, i) =>
      console.log(`\n  │  [${i + 1}] 逾期时间:${x.endDay}  逾期账期数:${x.billType}  逾期金额:${x.endMoney}  是否结清:${x.endFlag === 'Y' ? '已结清' : '未结清'}`),
    );
  }

  console.log('\n  ├ 近1月共债概况');
  console.log(`  │  机构数:${r.current_org_count || '-'}  订单数:${r.current_order_count || '-'}  已还款:${r.current_order_amt || '-'}  订单金额:${r.current_order_lend_amt || '-'}`);

  console.log('\n  └ 历史共债（近6个自然月）');
  if (!r.totaldebt_detail?.length) {
    console.log('     （无历史共债记录）');
  } else {
    r.totaldebt_detail.forEach((x) =>
      console.log(`\n     时间范围:${x.totaldebt_date}  共债机构数:${x.totaldebt_org_count}  共债订单数:${x.totaldebt_order_count}  疑似借新还旧:${x.new_or_old}`),
    );
  }
}

/* ── 综合指数V2 ZX-RadarV2 ── */
function printZxRadarV2 (d) {
  printBizMeta(d);
  const { code, results } = d
  if (code !== '0' || !results?.result_detail) {
    console.log('\n  未命中，无结果数据。');
    return;
  }
  const r = results.result_detail;
  const ar = r.apply_report_detail || {};
  const br = r.behavior_report_detail || {};
  const cr = r.current_report_detail || {};

  console.log('\n  ┌ 申请雷达报告详情');
  console.log(`  │  申请准入分:${ar.A22160001 ?? '-'}  置信度:${ar.A22160002 ?? '-'}  命中机构:${ar.A22160003 ?? '-'}`);
  console.log(`  │  申请命中消金类机构数:${ar.A22160004 ?? '-'}  申请命中网络贷款类机构数:${ar.A22160005 ?? '-'}  机构总查询次数:${ar.A22160006 ?? '-'}  最近一次查询时间:${ar.A22160007 ?? '-'}`);
  console.log(`  │  查询次数 近1月:${ar.A22160008 ?? '-'}  近3月:${ar.A22160009 ?? '-'}  近6月:${ar.A22160010 ?? '-'}`);

  console.log('\n  ├ 行为雷达报告详情');
  console.log(`  │  贷款行为分:${br.B22170001 ?? '-'}  置信度:${br.B22170051 ?? '-'}  正常还款率:${br.B22170034 ?? '-'}%`);
  console.log(`  │  贷款笔数 近1月:${br.B22170002 ?? '-'}  近3月:${br.B22170003 ?? '-'}  近6月:${br.B22170004 ?? '-'}  近12月:${br.B22170005 ?? '-'}`);
  console.log(`  │  逾期笔数(M0+) 近6月:${br.B22170025 ?? '-'}  近12月:${br.B22170026 ?? '-'}`);
  console.log(`  │  逾期笔数(M1+) 近6月:${br.B22170028 ?? '-'}  近12月:${br.B22170029 ?? '-'}`);
  console.log(`  │  失败扣款 近1月:${br.B22170035 ?? '-'}  近3月:${br.B22170036 ?? '-'}  近6月:${br.B22170037 ?? '-'}`);

  console.log('\n  └ 信用现状报告详情');
  console.log(`     网贷建议额度:${cr.C22180001 ?? '-'}元  置信度:${cr.C22180002 ?? '-'}  在贷机构:${cr.C22180003 ?? '-'}`);
  console.log(`     消金建议额度:${cr.C22180011 ?? '-'}元  置信度:${cr.C22180012 ?? '-'}  在贷机构:${cr.C22180007 ?? '-'}`);
}

/* ── 信用探查指数 QJTZ ── */
const QJTZ_CODE_MAP = {
  '1': 'A(Overdue)  有逾期',
  '2': 'B(Normal)   正常履约',
  '3': 'B(Delay)    延迟履约',
  '4': 'U           无数据',
};

function printQjtz (d) {
  printBizMeta(d);
  const { code, results } = d
  if (code !== '0' || !results?.result_detail) {
    console.log('\n  未命中，无结果数据。');
    return;
  }
  const r = results.result_detail;
  console.log(`\n  信用状态: ${QJTZ_CODE_MAP[r.result_code] ?? r.result_code}`);
  console.log('\n  ┌ 结果详情');
  console.log(`  │  最大逾期金额:${r.max_overdue_amt ?? '-'}  最长逾期天数:${r.max_overdue_days ?? '-'}  最近逾期时间:${r.latest_overdue_time ?? '-'}`);
  console.log(`  └  最大履约金额:${r.max_performance_amt ?? '-'}  最近履约时间:${r.latest_performance_time ?? '-'}  履约笔数:${r.count_performance ?? '-'}`);
  console.log(`  └  当前逾期机构数:${r.currently_overdue ?? '-'}  当前履约机构数:${r.currently_performance ?? '-'}  异常还款机构数:${r.acc_exc ?? '-'}  睡眠机构数:${r.acc_sleep ?? '-'}`);
}

/* ── 履约指数 FMLH ── */
const FMLH_CODE_MAP = {
  '1': 'A(Overdue)  有逾期',
  '4': 'U           无数据',
};

function printFmlh (d) {
  printBizMeta(d);
  const { code, results } = d
  if (code !== '0' || !results?.result_detail) {
    console.log('\n  未命中，无结果数据。');
    return;
  }
  const r = results.result_detail;
  console.log(`\n  履约状态: ${FMLH_CODE_MAP[r.result_code] ?? r.result_code}`);

  console.log('\n  ┌ 结果详情');
  console.log(`  │  最大逾期金额:${r.max_overdue_amt ?? '-'}  最长逾期天数:${r.max_overdue_days ?? '-'}  最近逾期:${r.latest_overdue_time ?? '-'}`);
  console.log(`  └  当前逾期机构:${r.currently_overdue ?? '-'}  当前履约机构:${r.currently_performance ?? '-'}  异常还款:${r.acc_exc ?? '-'}  睡眠机构:${r.acc_sleep ?? '-'}`);
}

// ─────────────────────────────────────────────
// 产品路由表
// ─────────────────────────────────────────────

const PRODUCTS = {
  qjda: {
    tool: 'getXunxinQjdaV130',
    title: '迅信-全景指数 QJDA 1.3.0',
    print: printQjda,
  },
  zxradarv2: {
    tool: 'getXunxinZxRadarV2',
    title: '迅信-综合指数V2 ZX-RadarV2_1 2.1.0',
    print: printZxRadarV2,
  },
  qjtz: {
    tool: 'getXunxinQjtzV140',
    title: '迅信-信用探查指数 QJTZ 1.4.0',
    print: printQjtz,
  },
  fmlh: {
    tool: 'getXunxinFmlhV140',
    title: '迅信-履约指数 FMLH 1.4.0',
    print: printFmlh,
  },
};

// ─────────────────────────────────────────────
// 命令实现
// ─────────────────────────────────────────────

function cmdInit (args) {
  if (!args.authorization) {
    console.error('错误：--authorization 为必填参数');
    console.error('示例：mandao init --authorization "Bearer YOUR_API_KEY"');
    console.error('      mandao init --authorization "YOUR_API_KEY"  （会自动补充 Bearer 前缀）');
    process.exit(1);
  }
  // 自动补充 Bearer 前缀
  const authValue = args.authorization.startsWith('Bearer ')
    ? args.authorization
    : `Bearer ${args.authorization}`;
  const cfg = {
    authorization: authValue,
    url: args.url || DEFAULT_URL,
  };
  saveConfig(cfg);
  console.log('✓ 初始化完成，配置已保存到:', CONFIG_FILE);
  console.log(`  authorization: ${cfg.authorization}`);
  console.log(`  url:           ${cfg.url}`);
}

function cmdConfigShow () {
  const cfg = loadConfig();
  if (!cfg) {
    console.log('尚未初始化，请先执行：mandao init --authorization "Bearer YOUR_API_KEY"');
    return;
  }
  console.log('当前配置（来自', CONFIG_FILE + '）：');
  console.log(JSON.stringify(cfg, null, 2));
}

async function cmdQuery (product, args) {
  const def = PRODUCTS[product];
  if (!def) {
    console.error(`错误：未知产品 "${product}"，可用产品：${Object.keys(PRODUCTS).join(' / ')}`);
    process.exit(1);
  }
  if (!args.idNo || !args.idName) {
    console.error('错误：--idNo 和 --idName 为必填参数');
    console.error(`示例：mandao query ${product} --idNo 110101199001011234 --idName 张三`);
    process.exit(1);
  }

  const cfg = requireConfig();
  const params = { idNo: args.idNo, idName: args.idName };
  if (args.phoneNo) params.phoneNo = args.phoneNo;

  printHeader(def.title, args);
  console.log('  正在查询...');

  let mcpResult;
  try {
    mcpResult = await callMcpTool(def.tool, params, cfg);
  } catch (err) {
    console.error('\n查询失败：', err.message);
    if (err.cause) console.error('底层原因：', err.cause?.code ?? err.cause?.message ?? err.cause);
    console.error(`\n  请确认 MCP 服务地址可达：${cfg.url || DEFAULT_URL}`);
    console.error('  可用 mandao config show 查看当前配置');
    process.exit(1);
  }

  let bizData;
  try {
    bizData = extractBizData(mcpResult);
  } catch (err) {
    console.error('\n解析失败：', err.message);
    process.exit(1);
  }

  if (args.json) {
    console.log(JSON.stringify(bizData, null, 2));
    return;
  }

  def.print(bizData);
  console.log(`\n${'─'.repeat(56)}`);

  if (args.verbose) {
    console.log('\n原始数据：');
    console.log(JSON.stringify(bizData, null, 2));
  }
}

function printHelp () {
  console.log(`
      mandao-agent-cli — 漫道金融风控 MCP 命令行工具

      用法：
        mandao init --authorization "Bearer <API_KEY>" [--url <MCP_URL>]
        mandao query <产品> --idNo <身份证> --idName <姓名> [--phoneNo <手机号>] [--json] [--verbose]
        mandao config show

      产品列表：
        qjda       全景指数 QJDA 1.3.0         逾期+共债双维度
        zxradarv2  综合指数V2 ZX-RadarV2_1 2.1  申请/行为/信用现状三报告（建模首选）
        qjtz       信用探查指数 QJTZ 1.4.0      逾期+履约双维度，四态判断
        fmlh       履约指数 FMLH 1.4.0          快速逾期初筛，两态判断

      示例：
        mandao init --authorization "Bearer test"
        mandao query qjda --idNo 110101199001011234 --idName 张三 --phoneNo 13800138000
        mandao query zxradarv2 --idNo 110101199001011234 --idName 张三
        mandao query qjtz --idNo 110101199001011234 --idName 张三 --json
        mandao query fmlh --idNo 110101199001011234 --idName 张三 --verbose
  `);
}

async function main () {
  const argv = process.argv.slice(2);
  if (!argv.length) { printHelp(); return; }

  const cmd = argv[0];
  const args = parseArgs(argv.slice(1));

  switch (cmd) {
    case 'init':
      cmdInit(args);
      break;

    case 'config':
      if (args._[0] === 'show') cmdConfigShow();
      else { console.error('用法：mandao config show'); process.exit(1); }
      break;

    case 'query': {
      const product = args._[0];
      if (!product) {
        console.error(`错误：请指定产品，可用：${Object.keys(PRODUCTS).join(' / ')}`);
        process.exit(1);
      }
      await cmdQuery(product, args);
      break;
    }

    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;

    default:
      console.error(`错误：未知命令 "${cmd}"`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('未预期错误：', err.message);
  process.exit(1);
});
