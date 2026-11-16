#!/bin/bash
# Generates llms.txt and llms-full.txt from doc files.
# Run as part of the build or manually.

set -e

DOCS_DIR="$(dirname "$0")/../docs"
OUTPUT_DIR="$DOCS_DIR/public"
LLMS_TXT="$OUTPUT_DIR/llms.txt"
LLMS_FULL="$OUTPUT_DIR/llms-full.txt"
SITE="https://llm-exe.com"

mkdir -p "$OUTPUT_DIR"

# --- llms.txt (summary + links) ---

{
  echo "# llm-exe"
  echo ""
  echo "> A lightweight, modular TypeScript toolkit for building LLM-powered applications. Core pattern: Prompt → LLM → Parser → Typed Result."
  echo ""
  echo "- Website: $SITE"
  echo "- GitHub: https://github.com/llm-exe/llm-exe"
  echo "- npm: https://www.npmjs.com/package/llm-exe"
  echo ""
  echo "## Docs"
  echo ""

  # Walk the sidebar structure logically
  sections=(
    "Getting Started|intro/install|intro/index|intro/what_is_llm_function"
    "LLM Providers|llm/index|llm/generic|llm/openai|llm/anthropic|llm/gemini|llm/bedrock/index|llm/xai|llm/ollama|llm/deepseek|llm/custom"
    "Prompts|prompt/index|prompt/chat|prompt/text|prompt/advanced|prompt/why-handlebars"
    "Parsers|parser/index|parser/included-parsers|parser/custom"
    "State|state/index|state/dialogue"
    "Executor|executor/index|executor/openai-functions|executor/hooks"
    "Embeddings|embeddings/index|embeddings/openai|embeddings/amazon"
    "Decision Executor|decision/index|decision/providers"
    "Examples|examples/FunctionSyntax|examples/concepts/working-with-json|examples/concepts/replicating-lex"
  )

  for section in "${sections[@]}"; do
    IFS='|' read -ra parts <<< "$section"
    heading="${parts[0]}"
    echo "### $heading"

    for ((i=1; i<${#parts[@]}; i++)); do
      page="${parts[$i]}"
      filepath="$DOCS_DIR/${page}.md"
      if [ -f "$filepath" ]; then
        # Extract title from first heading or frontmatter
        title=$(grep -m1 '^# ' "$filepath" | sed 's/^# //' || echo "$page")
        if [ -z "$title" ]; then
          title=$(basename "$page")
        fi
        echo "- [$title](${SITE}/${page}.html)"
      fi
    done
    echo ""
  done
} > "$LLMS_TXT"

echo "Generated $LLMS_TXT"

# --- llms-full.txt (all content concatenated) ---

{
  echo "# llm-exe Documentation"
  echo ""
  echo "> Complete documentation for llm-exe — a lightweight TypeScript toolkit for building LLM-powered applications."
  echo ""

  # Ordered file list
  FILES=(
    intro/install.md
    intro/index.md
    intro/what_is_llm_function.md
    llm/index.md
    llm/generic.md
    llm/openai.md
    llm/anthropic.md
    llm/gemini.md
    llm/bedrock/index.md
    llm/bedrock/anthropic.md
    llm/bedrock/meta.md
    llm/xai.md
    llm/ollama.md
    llm/deepseek.md
    llm/custom.md
    prompt/index.md
    prompt/chat.md
    prompt/text.md
    prompt/advanced.md
    prompt/why-handlebars.md
    parser/index.md
    parser/included-parsers.md
    parser/custom.md
    state/index.md
    state/dialogue.md
    executor/index.md
    executor/openai-functions.md
    executor/hooks.md
    executor/options.md
    embeddings/index.md
    embeddings/openai.md
    embeddings/amazon.md
    callable/index.md
    examples/FunctionSyntax.md
    examples/concepts/working-with-json.md
    examples/concepts/replicating-lex.md
  )

  for file in "${FILES[@]}"; do
    filepath="$DOCS_DIR/$file"
    if [ -f "$filepath" ]; then
      # Strip frontmatter
      sed '/^---$/,/^---$/d' "$filepath"
      echo ""
      echo "---"
      echo ""
    fi
  done
} > "$LLMS_FULL"

echo "Generated $LLMS_FULL"
