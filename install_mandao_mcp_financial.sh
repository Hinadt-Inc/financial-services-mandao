#!/bin/bash
# Financial Services Mandao MCP Plugin Installation Script
# 金融机构漫道迅信MCP插件安装脚本
#
#
# 一键安装命令:
#   bash <(curl -sL https://raw.githubusercontent.com/hinadt/financial-services-mandao/main/install_mandao_mcp_financial.sh)
#
# 本地安装命令:
#   bash install_mandao_mcp_financial.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "  Financial Services Mandao MCP Installer"
echo "  金融机构漫道迅信MCP安装程序"
echo "=========================================="
echo ""

if [[ "$OSTYPE" == "darwin"* ]]; then
  PLATFORM="macOS"
  CLAUDE_DIR="$HOME/.claude"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  PLATFORM="Linux"
  CLAUDE_DIR="$HOME/.claude"
else
  echo -e "${RED}Unsupported platform: $OSTYPE${NC}"
  echo "This script supports macOS and Linux only."
  exit 1
fi

echo -e "${BLUE}Detected platform: $PLATFORM${NC}"
echo ""

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
INSTALL_MODE="local"
SOURCE_DIR=""
TEMP_DIR=""

if [[ "$SCRIPT_SOURCE" == /dev/fd/* ]] || [[ "$SCRIPT_SOURCE" == /proc/*/fd/* ]] || [ ! -f "$SCRIPT_SOURCE" ]; then
  INSTALL_MODE="curl"
  echo -e "${BLUE}Installation mode: curl (downloading from GitHub)${NC}"

  # 与 install_qcc_mcp_financial.sh 一致：curl 管道执行时默认拉 main 分支 tarball；可用 MANDAO_INSTALL_TAR_URL 覆盖（如私有 fork、固定 tag）
  MANDAO_INSTALL_TAR_URL="${MANDAO_INSTALL_TAR_URL:-https://github.com/hinadt/financial-services-mandao/archive/refs/heads/main.tar.gz}"

  TEMP_DIR=$(mktemp -d)
  echo -e "${BLUE}Downloading from: $MANDAO_INSTALL_TAR_URL${NC}"

  if command -v curl &> /dev/null; then
    curl -sL "$MANDAO_INSTALL_TAR_URL" | tar -xz -C "$TEMP_DIR" --strip-components=1
  elif command -v wget &> /dev/null; then
    wget -qO- "$MANDAO_INSTALL_TAR_URL" | tar -xz -C "$TEMP_DIR" --strip-components=1
  else
    echo -e "${RED}Error: curl or wget is required${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
  fi

  SOURCE_DIR="$TEMP_DIR"
else
  echo -e "${BLUE}Installation mode: local${NC}"
  SOURCE_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
fi

MANDAO_MCP_SSE_URL="${MANDAO_MCP_SSE_URL:-https://agent.hinadt.com/mcp}"

if [ -z "${MANDAO_MCP_API_KEY:-}" ]; then
  echo -e "${YELLOW}⚠️  MANDAO_MCP_API_KEY not found in environment${NC}"
  echo ""
  echo "To call Mandao MCP tools from Claude Code, set an API key / token used in Authorization."
  echo ""
  echo "Options:"
  echo "1. Continue without key (you can set MANDAO_MCP_API_KEY later + edit ~/.claude/.mcp.json)"
  echo "2. Enter key now (exported for this shell session only)"
  echo "3. Exit and configure later"
  echo ""
  read -p "Select option (1/2/3): " choice

  case $choice in
    1)
      echo -e "${YELLOW}Continuing without Mandao MCP key (demo / manual config later).${NC}"
      echo -e "${YELLOW}  ~/.claude/.mcp.json will still contain Bearer \${MANDAO_MCP_API_KEY} — set the variable before starting Claude.${NC}"
      ;;
    2)
      read -p "Enter your Mandao MCP API Key / token: " api_key
      export MANDAO_MCP_API_KEY="$api_key"
      echo -e "${GREEN}✓ Key set for this session${NC}"
      echo ""
      echo "To persist, add to your shell profile:"
      if [[ "$PLATFORM" == "macOS" ]]; then
        echo "  echo 'export MANDAO_MCP_API_KEY=\"$api_key\"' >> ~/.zshrc"
      else
        echo "  echo 'export MANDAO_MCP_API_KEY=\"$api_key\"' >> ~/.bashrc"
      fi
      ;;
    3)
      echo "Exiting. Set MANDAO_MCP_API_KEY and run again."
      [ -n "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"
      exit 0
      ;;
    *)
      echo "Invalid option. Exiting."
      [ -n "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"
      exit 1
      ;;
  esac
else
  echo -e "${GREEN}✓ MANDAO_MCP_API_KEY found${NC}"
fi

echo ""
echo "=========================================="
echo "  Step 1: Installing MCP Configuration"
echo "=========================================="
echo ""

MCP_CONFIG_DEST="$CLAUDE_DIR/.mcp.json"
echo -e "${BLUE}Installing MCP server configuration...${NC}"

if [ -f "$MCP_CONFIG_DEST" ]; then
  echo -e "${YELLOW}  Existing .mcp.json found, backing up...${NC}"
  cp "$MCP_CONFIG_DEST" "${MCP_CONFIG_DEST}.backup.$(date +%Y%m%d%H%M%S)"
  echo -e "${YELLOW}  ⚠ If you use other MCP servers (e.g. QCC), merge servers manually from the backup.${NC}"
fi

mkdir -p "$CLAUDE_DIR"

cat > "$MCP_CONFIG_DEST" << MCPJSONEOF
{
  "mcpServers": {
    "mandao-company": {
      "url": "${MANDAO_MCP_SSE_URL}",
      "headers": {
        "Authorization": "Bearer \${MANDAO_MCP_API_KEY}"
      },
      "description": "漫道迅信MCP - 全景指数/综合指数V2/信用探查指数/履约指数"
    }
  }
}
MCPJSONEOF

echo -e "${GREEN}  ✓ MCP configuration installed to: $MCP_CONFIG_DEST${NC}"

echo ""
echo "=========================================="
echo "  Step 2: Installing Skills (xunxin-*)"
echo "=========================================="

SKILLS_DIR="$CLAUDE_DIR/skills"
mkdir -p "$SKILLS_DIR"

MANDAO_SKILLS=(
  "xunxin-qjda"
  "xunxin-zxradarv2"
  "xunxin-qjtz"
  "xunxin-fmlh"
)

for skill in "${MANDAO_SKILLS[@]}"; do
  echo ""
  echo -e "${BLUE}Installing skill: $skill ...${NC}"
  SRC_SKILL="$SOURCE_DIR/skills/$skill"
  if [ ! -d "$SRC_SKILL" ]; then
    echo -e "${RED}  ✗ Missing: $SRC_SKILL${NC}"
    continue
  fi
  DEST_SKILL="$SKILLS_DIR/$skill"
  if [ -d "$DEST_SKILL" ]; then
    echo -e "${YELLOW}  Existing $skill found, backing up...${NC}"
    mv "$DEST_SKILL" "${DEST_SKILL}.backup.$(date +%Y%m%d%H%M%S)"
  fi
  mkdir -p "$DEST_SKILL"
  if [ -f "$SRC_SKILL/SKILL.md" ]; then
    cp "$SRC_SKILL/SKILL.md" "$DEST_SKILL/"
  fi
  if [ -f "$SRC_SKILL/reference.md" ]; then
    cp "$SRC_SKILL/reference.md" "$DEST_SKILL/"
  fi
  echo -e "${GREEN}  ✓ $skill installed${NC}"
done

echo ""
echo "=========================================="
echo "  Step 3: Installing CLI & scripts bundle"
echo "=========================================="

BUNDLE_DEST="$CLAUDE_DIR/financial-services-mandao"
if [ -d "$BUNDLE_DEST" ]; then
  echo -e "${YELLOW}Existing bundle directory found, backing up...${NC}"
  mv "$BUNDLE_DEST" "${BUNDLE_DEST}.backup.$(date +%Y%m%d%H%M%S)"
fi
mkdir -p "$BUNDLE_DEST"

if [ -d "$SOURCE_DIR/bin" ]; then
  cp -R "$SOURCE_DIR/bin" "$BUNDLE_DEST/"
  echo -e "${GREEN}  ✓ bin/ copied${NC}"
fi
if [ -d "$SOURCE_DIR/scripts" ]; then
  cp -R "$SOURCE_DIR/scripts" "$BUNDLE_DEST/"
  echo -e "${GREEN}  ✓ scripts/ copied${NC}"
fi
for f in package.json package-lock.json pnpm-lock.yaml; do
  if [ -f "$SOURCE_DIR/$f" ]; then
    cp "$SOURCE_DIR/$f" "$BUNDLE_DEST/"
    echo -e "${GREEN}  ✓ $f copied${NC}"
  fi
done

if [ -f "$SOURCE_DIR/docs/MCP_CONFIGURATION.md" ]; then
  mkdir -p "$BUNDLE_DEST/docs"
  cp "$SOURCE_DIR/docs/MCP_CONFIGURATION.md" "$BUNDLE_DEST/docs/"
  echo -e "${GREEN}  ✓ docs/MCP_CONFIGURATION.md copied${NC}"
fi

echo ""
echo "=========================================="
echo "  Step 4: Verifying Installation"
echo "=========================================="
echo ""

echo -e "${BLUE}Checking MCP configuration...${NC}"
if [ -f "$MCP_CONFIG_DEST" ]; then
  echo -e "${GREEN}  ✓ $MCP_CONFIG_DEST${NC}"
else
  echo -e "${RED}  ✗ MCP config missing${NC}"
fi

echo ""
echo -e "${BLUE}Checking Node.js (CLI mandao.js requires >= 20)...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${YELLOW}⚠️  node not found. Install Node.js 20+ for mandao CLI.${NC}"
else
  echo -e "${GREEN}✓ node: $(node --version)${NC}"
  NODE_MAJOR=$(node -p "parseInt(process.versions.node.split('.')[0],10)" 2>/dev/null || echo 0)
  if [ "$NODE_MAJOR" -lt 20 ]; then
    echo -e "${YELLOW}⚠️  Node.js >= 20 recommended for global fetch in bin/mandao.js${NC}"
  fi
fi

echo ""
echo -e "${BLUE}Verifying skills...${NC}"
for skill in "${MANDAO_SKILLS[@]}"; do
  if [ -f "$SKILLS_DIR/$skill/SKILL.md" ]; then
    echo -e "${GREEN}  ✓ $skill/SKILL.md${NC}"
  else
    echo -e "${RED}  ✗ $skill/SKILL.md missing${NC}"
  fi
done

echo ""
echo -e "${BLUE}Verifying bundle...${NC}"
if [ -f "$BUNDLE_DEST/bin/mandao.js" ]; then
  echo -e "${GREEN}  ✓ mandao.js${NC}"
else
  echo -e "${RED}  ✗ mandao.js missing${NC}"
fi

echo ""
echo "=========================================="
echo "  Installation Complete!"
echo "=========================================="
echo ""
echo -e "${GREEN}Financial Services Mandao MCP bundle has been installed.${NC}"
echo ""
echo "Installed components:"
echo "  MCP:    mandao-company → $MANDAO_MCP_SSE_URL"
echo "  Skills: ${MANDAO_SKILLS[*]}"
echo "  Bundle: $BUNDLE_DEST"
echo ""

if [ -n "${MANDAO_MCP_API_KEY:-}" ]; then
  echo -e "${GREEN}Mandao MCP Status: CONFIGURED (MANDAO_MCP_API_KEY set in this shell)${NC}"
  echo "Ensure the same environment launches Claude Code so the key is visible to the MCP client."
else
  echo -e "${YELLOW}Mandao MCP Status: NOT CONFIGURED${NC}"
  echo "To enable Mandao / Xunxin MCP:"
  echo "  export MANDAO_MCP_API_KEY='your_key_here'"
fi

echo ""
echo "=========================================="
echo "  ⚠️  IMPORTANT: Post-Installation Steps"
echo "=========================================="
echo ""
echo -e "${YELLOW}You MUST restart Claude Code to load the MCP configuration!${NC}"
echo ""
echo "Step 1: Completely exit Claude Code"
echo "Step 2: Ensure MANDAO_MCP_API_KEY is set:"
echo "       export MANDAO_MCP_API_KEY='your_api_key_here'"
echo "Step 3: Restart Claude Code"
echo "Step 4: Verify MCP server is loaded:"
echo "       You should see 'mandao-company' in available tools"
echo ""
echo "=========================================="
echo "  Quick Start"
echo "=========================================="
echo ""
echo "After restarting Claude Code:"
echo ""
echo "1. Verify MCP: Claude should list tools from mandao-company (e.g. getXunxinFmlhV140)."
echo ""
echo "2. Slash skills (see each SKILL.md):"
echo ""
echo "   /xunxin-qjda --idNo ... --idName ..."
echo "   /xunxin-zxradarv2 --idNo ... --idName ..."
echo "   /xunxin-qjtz --idNo ... --idName ..."
echo "   /xunxin-fmlh --idNo ... --idName ..."
echo ""
echo "3. CLI (bundle installed under home):"
echo "   node $BUNDLE_DEST/bin/mandao.js init --authorization \"Bearer \$MANDAO_MCP_API_KEY\""
echo "   node $BUNDLE_DEST/bin/mandao.js query qjda --idNo ... --idName ..."
echo ""
echo "4. Optional global CLI: cd $BUNDLE_DEST && npm install -g ."
echo ""
echo "=========================================="
echo "  Documentation"
echo "=========================================="
echo ""
echo "• README.md                    - 项目说明与技能总览"
echo "• docs/MCP_CONFIGURATION.md - 配置、验证、排障（已复制到 $BUNDLE_DEST/docs/）"
echo "• SKILL.md (each skill)       - 使用指南"
echo "• reference.md (each skill)   - 字段参考"
echo ""
echo -e "${GREEN}🎉 Installation complete!${NC}"
echo ""

if [ "$INSTALL_MODE" == "curl" ] && [ -n "$TEMP_DIR" ]; then
  rm -rf "$TEMP_DIR"
fi
