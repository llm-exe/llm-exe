#!/usr/bin/env bash
# Shared configuration for agent scripts

# Repository settings
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEFAULT_BRANCH="development"
GITHUB_REMOTE="origin"

# Agent settings
DATE_STAMP="$(date +%Y-%m-%d)"
AGENT_TIMEOUT=600 # 10 minutes per agent

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper: print colored status messages
info()  { echo -e "${BLUE}[info]${NC} $*"; }
ok()    { echo -e "${GREEN}[ok]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC} $*"; }
err()   { echo -e "${RED}[error]${NC} $*"; }

# Helper: create a fresh branch from the default branch
create_agent_branch() {
  local role="$1"
  local suffix="${2:-}"
  local branch="agent/${role}/${DATE_STAMP}"
  if [[ -n "$suffix" ]]; then
    branch="${branch}-${suffix}"
  fi

  cd "$REPO_ROOT" || exit 1
  git checkout "$DEFAULT_BRANCH" &>/dev/null
  git pull "$GITHUB_REMOTE" "$DEFAULT_BRANCH" &>/dev/null
  git checkout -b "$branch" &>/dev/null
  echo "$branch"
}

# Agent logs directory
LOGS_DIR="$REPO_ROOT/scripts/agents/logs"

# Helper: clock in — create skeleton log file, return its path
clock_in() {
  local agent="$1"
  local branch="$2"
  local timestamp
  timestamp="$(date +%Y-%m-%dT%H-%M-%S)"
  local log_dir="$LOGS_DIR/$agent"
  local log_file="$log_dir/${timestamp}.md"

  mkdir -p "$log_dir"
  cat > "$log_file" <<EOF
# $agent agent — ${timestamp//-/:}

- **Branch**: $branch
- **Started**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- **Finished**: —
- **Status**: running

## Summary
_Pending — agent will fill this in._

## Files Changed
_Pending — agent will fill this in._

## Next Steps
_Pending — agent will fill this in._
EOF

  echo "$log_file"
}

# The placeholder clock_in writes into every section of a fresh log
LOG_PLACEHOLDER="_Pending — agent will fill this in._"

# Helper: did the agent actually write anything into its log?
# Returns 0 if at least one section was filled in, 1 if every section is still
# the clock_in placeholder (or the file is missing entirely).
log_has_content() {
  local log_file="$1"
  [[ -f "$log_file" ]] || return 1
  local remaining
  remaining="$(grep -c -F "$LOG_PLACEHOLDER" "$log_file" || true)"
  [[ "$remaining" -lt 3 ]]
}

# Helper: clock out — stamp finish time and update status
# Status reflects what actually happened:
#   interrupted — the agent exited nonzero
#   no-output   — the agent exited clean but left every section untouched
#   completed   — the agent exited clean and wrote something
# Returns nonzero for interrupted/no-output so callers can react.
clock_out() {
  local log_file="$1"
  local exit_code="${2:-0}"
  local status="completed"
  local result=0

  if [[ "$exit_code" -ne 0 ]]; then
    status="interrupted"
    result=1
  elif ! log_has_content "$log_file"; then
    status="no-output"
    result=2
  fi

  if [[ -f "$log_file" ]]; then
    local tmp="${log_file}.tmp"
    sed "s|^\- \*\*Finished\*\*: —|- **Finished**: $(date -u +%Y-%m-%dT%H:%M:%SZ)|" "$log_file" \
      | sed "s|^\- \*\*Status\*\*: running|- **Status**: $status|" > "$tmp"
    mv "$tmp" "$log_file"
  fi

  return "$result"
}

# Helper: get recent log files for an agent (last N, default 3)
recent_logs() {
  local agent="$1"
  local count="${2:-3}"
  local log_dir="$LOGS_DIR/$agent"
  if [[ -d "$log_dir" ]]; then
    ls -1 "$log_dir"/*.md 2>/dev/null | sort | tail -"$count"
  fi
}

# Helper: run claude interactively (local) or non-interactively (CI)
run_claude() {
  local prompt="$1"
  local deadline
  deadline="$(date -u -d "+${AGENT_TIMEOUT} seconds" +%H:%M 2>/dev/null || date -u -v+${AGENT_TIMEOUT}S +%H:%M)"

  local time_notice="

## Time Budget
You started at $(date -u +%H:%M) UTC. You have 10 minutes — wrap up by ${deadline} UTC.
Run \`date -u +%H:%M\` periodically to check how much time you have left.
If you're running low on time, commit what you have, update your log file, and stop. A partial result is better than getting killed mid-work."

  prompt="${prompt}${time_notice}"

  if [[ -n "${AGENT_INSTRUCTIONS:-}" ]]; then
    prompt="${prompt}

## Additional Instructions from Maintainer
${AGENT_INSTRUCTIONS}"
  fi

  if [[ "${CI:-}" == "true" ]]; then
    timeout "$AGENT_TIMEOUT" claude -p "$prompt" --verbose || return $?
  else
    claude "$prompt"
  fi
}

# Verify prerequisites
check_prerequisites() {
  local missing=0

  if ! command -v claude &>/dev/null; then
    err "claude CLI not found. Install: https://docs.anthropic.com/en/docs/claude-code"
    missing=1
  fi

  if ! command -v gh &>/dev/null; then
    err "gh CLI not found. Install: https://cli.github.com"
    missing=1
  fi

  if ! command -v git &>/dev/null; then
    err "git not found"
    missing=1
  fi

  if [[ $missing -eq 1 ]]; then
    exit 1
  fi
}
