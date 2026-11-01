#!/usr/bin/env bash
# Runner script for llm-exe maintenance agents
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENTS_DIR="$SCRIPT_DIR/agents"
PROMPTS_DIR="$AGENTS_DIR/prompts"

source "$AGENTS_DIR/config.sh"

TASK_AGENTS=(docs tester coder scout docs-sync)
PERSONAS=(beginner harsh-critic speed-runner enterprise)

# Persona logs written by run_persona in this invocation. `all` hands exactly
# these to the curator, so a log is curated by the run that wrote it.
PERSONA_RUN_LOGS=()

usage() {
  cat <<EOF
Usage: ./scripts/maintain.sh <command>

Task agents (create branches, make changes, open PRs):
  docs           Documentation agent
  tester         Test coverage agent
  coder          Code fix/feature agent
  docs-sync      Keep workflow deep-dive docs in sync with workflow source files

Research:
  scout          Monitor provider docs for new models, deprecations, API changes

Persona agents (use the library, report findings):
  beginner       New developer, follows docs literally
  harsh-critic   Senior dev, zero patience for rough edges
  speed-runner   Skips docs, figures it out by trying
  enterprise     Production-minded, cares about edge cases
  personas       Run all personas sequentially

Curator (reviews persona findings, files real issues):
  curator <log.md>...
                 Gatekeeper: promotes signal, kills noise. Curates only the
                 persona logs given ('all' passes the ones it just wrote)

PR review:
  review <PR#>   Review a PR — approve, request changes, or close

Meta:
  all            Run all personas, then curator

Options:
  -h, --help     Show this help message

Claude starts interactively — you see output in real time and can Ctrl+C.
EOF
  exit 0
}

# Run a task agent (docs, tester, coder) — creates branch, makes changes
run_task_agent() {
  local agent="$1"
  local prompt_file="$PROMPTS_DIR/${agent}.md"

  if [[ ! -f "$prompt_file" ]]; then
    err "Unknown agent '$agent'. Run with --help for options."
    exit 1
  fi

  check_prerequisites
  info "Starting $agent agent..."

  local branch
  branch=$(create_agent_branch "$agent")
  info "Working on branch: $branch"

  local log_file
  log_file=$(clock_in "$agent" "$branch")
  info "Log file: $log_file"

  local prior_context
  prior_context=$(build_prior_context "$agent" "$log_file")

  local prompt
  prompt=$(sed -e "s|\$BRANCH|$branch|g" -e "s|\$LOG_FILE|$log_file|g" "$prompt_file")
  prompt="${prompt}${prior_context}"

  local exit_code=0
  run_claude "$prompt" || exit_code=$?

  clock_out "$log_file" "$exit_code"

  if [[ "$exit_code" -ne 0 ]]; then
    warn "$agent agent interrupted (exit $exit_code). Log: $log_file"
  elif ! log_has_content "$log_file"; then
    warn "$agent agent exited clean but wrote no findings; the log is still all placeholders. Log: $log_file"
  else
    ok "$agent agent complete. Check for PR on branch: $branch"
  fi
}

# Run a persona agent — no branch, just uses the library and reports findings
run_persona() {
  local persona="$1"
  local base_file="$PROMPTS_DIR/_persona.md"
  local persona_file="$PROMPTS_DIR/personas/${persona}.md"

  if [[ ! -f "$persona_file" ]]; then
    err "Unknown persona '$persona'. Run with --help for options."
    exit 1
  fi

  check_prerequisites
  info "Starting persona: $persona..."

  cd "$REPO_ROOT" || exit 1

  local log_file
  log_file=$(clock_in "personas/$persona" "n/a")
  info "Log file: $log_file"

  local prior_context
  prior_context=$(build_prior_context "personas/$persona" "$log_file")

  # Assemble prompt: base persona template + specific persona personality
  local persona_block
  persona_block=$(<"$persona_file")
  local prompt
  prompt=$(<"$base_file")
  prompt=$(echo "$prompt" | sed "s|\$LOG_FILE|$log_file|g")
  prompt="${prompt/\$PERSONA/$persona_block}${prior_context}"

  local exit_code=0
  run_claude "$prompt" || exit_code=$?

  clock_out "$log_file" "$exit_code"
  PERSONA_RUN_LOGS+=("$log_file")

  if [[ "$exit_code" -ne 0 ]]; then
    warn "Persona $persona interrupted (exit $exit_code). Log: $log_file"
  elif ! log_has_content "$log_file"; then
    warn "Persona $persona exited clean but reported no findings; the log is still all placeholders. Log: $log_file"
  else
    ok "Persona $persona complete. Findings in: $log_file"
  fi
}

# Run the curator: reviews persona findings, files issues. It curates the log
# paths it is given plus any logs run_persona wrote in this invocation, staged
# in a temp dir as <persona>/<file>.md, the same layout CI downloads into.
# Staging happens before the cd so relative paths resolve from the caller's
# directory, and before create_agent_branch so a bad path leaves git alone.
run_curator() {
  check_prerequisites
  info "Starting curator..."

  local persona_logs_dir
  persona_logs_dir="$(mktemp -d "${TMPDIR:-/tmp}/curator-input.XXXXXX")"
  local persona_log
  for persona_log in "$@" ${PERSONA_RUN_LOGS[@]+"${PERSONA_RUN_LOGS[@]}"}; do
    stage_persona_log "$persona_logs_dir" "$persona_log" || { rm -rf "$persona_logs_dir"; exit 1; }
  done

  local log_count
  log_count="$(count_persona_logs "$persona_logs_dir")"
  if [[ "$log_count" -eq 0 ]]; then
    rm -rf "$persona_logs_dir"
    err "No persona logs to curate. Run 'all', or pass logs: ./scripts/maintain.sh curator <log.md>..."
    exit 1
  fi
  info "Curating $log_count persona log(s), staged in $persona_logs_dir"

  cd "$REPO_ROOT" || exit 1

  local branch
  branch=$(create_agent_branch "curator")
  info "Working on branch: $branch"

  local log_file
  log_file=$(clock_in "curator" "$branch")
  info "Log file: $log_file"

  local prompt
  prompt="$(render_curator_prompt "$branch" "$log_file" "$persona_logs_dir")"

  local exit_code=0
  run_claude "$prompt" || exit_code=$?

  clock_out "$log_file" "$exit_code"
  rm -rf "$persona_logs_dir"

  if [[ "$exit_code" -ne 0 ]]; then
    warn "Curator interrupted (exit $exit_code). Log: $log_file"
  elif ! log_has_content "$log_file"; then
    warn "Curator exited clean but wrote nothing; the log is still all placeholders. Log: $log_file"
  else
    ok "Curator complete. Review: $log_file"
  fi
}

# Run the reviewer — reviews a specific PR
run_reviewer() {
  local pr_number="$1"
  local prompt_file="$PROMPTS_DIR/reviewer.md"

  check_prerequisites
  info "Reviewing PR #$pr_number..."

  cd "$REPO_ROOT" || exit 1

  local log_file
  log_file=$(clock_in "reviewer" "PR #$pr_number")
  info "Log file: $log_file"

  local prompt
  prompt=$(sed -e "s|\$PR_NUMBER|$pr_number|g" -e "s|\$LOG_FILE|$log_file|g" "$prompt_file")

  local exit_code=0
  run_claude "$prompt" || exit_code=$?

  clock_out "$log_file" "$exit_code"

  if [[ "$exit_code" -ne 0 ]]; then
    warn "Review interrupted (exit $exit_code). Log: $log_file"
  elif ! log_has_content "$log_file"; then
    warn "Review of PR #$pr_number exited clean but wrote nothing; the log is still all placeholders. Log: $log_file"
  else
    ok "Review of PR #$pr_number complete. Log: $log_file"
  fi
}

# Parse arguments
if [[ $# -eq 0 ]] || [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
  usage
fi

case "$1" in
  docs|tester|coder|scout|docs-sync)
    run_task_agent "$1"
    ;;
  beginner|harsh-critic|speed-runner|enterprise)
    run_persona "$1"
    ;;
  personas)
    for persona in "${PERSONAS[@]}"; do
      echo ""
      echo "========================================="
      echo "  Persona: $persona"
      echo "========================================="
      echo ""
      run_persona "$persona"
    done
    ;;
  curator)
    shift
    run_curator "$@"
    ;;
  review)
    if [[ -z "${2:-}" ]]; then
      err "Usage: ./scripts/maintain.sh review <PR#>"
      exit 1
    fi
    run_reviewer "$2"
    ;;
  all)
    for persona in "${PERSONAS[@]}"; do
      echo ""
      echo "========================================="
      echo "  Persona: $persona"
      echo "========================================="
      echo ""
      run_persona "$persona"
    done
    echo ""
    echo "========================================="
    echo "  Curator (reviewing findings)"
    echo "========================================="
    echo ""
    run_curator
    ;;
  *)
    err "Unknown command '$1'. Run with --help for options."
    exit 1
    ;;
esac
