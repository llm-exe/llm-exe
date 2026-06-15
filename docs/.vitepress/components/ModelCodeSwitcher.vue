<template>
  <div class="switcher-root">
    <div v-if="providers.length > 0" class="provider-tabs">
      <button
        v-for="(provider, idx) in providers"
        :key="provider.key"
        :class="['provider-tab', { active: idx === activeProviderIdx }]"
        @click="
          activeProviderIdx = idx;
          activeModelIdx = 0;
        "
        :aria-label="provider.name"
      >
        <span class="provider-logo" v-html="provider.logo" />
        <span class="provider-name">{{ provider.name }}</span>
      </button>
    </div>
    <div
      v-if="
        providers.length > 0 && providers[activeProviderIdx]?.models?.length > 0
      "
      class="model-tabs"
    >
      <button
        v-for="(model, idx) in providers[activeProviderIdx].models"
        :key="model.id"
        :class="[
          'model-tab',
          { active: idx === activeModelIdx, deprecated: model.deprecated },
        ]"
        :title="model.message || ''"
        @click="activeModelIdx = idx"
      >
        <span>{{ model.id }}</span>
        <span v-if="model.deprecated" class="deprecated-badge">deprecated</span>
      </button>
    </div>
    <div class="code-area">
      <div class="code-actions">
        <button
          class="copy-btn"
          :class="{ copied }"
          @click="copyCode"
          :aria-label="copied ? 'Copied!' : 'Copy'"
        >
          <span v-if="!copied" class="copy-icon" v-html="clipboardIcon" />
          <span v-else class="copy-icon copied" v-html="checkIcon" />
        </button>
      </div>
      <pre
        class="code-block vp-code-block-switcher"
      ><code ref="codeEl" :class="`language-${detectedLanguage}`"></code></pre>
      <div v-if="props.output" class="output-label">Sample Output</div>
      <pre
        v-if="props.output"
        class="output-block vp-code-block-switcher"
      ><code ref="outputEl" :class="`language-${detectedLanguage}`"></code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, onUnmounted } from "vue";
import { inferLangFromFilename } from "../utils/codeLang";
import {
  getProviders,
  clipboardIcon,
  checkIcon,
  type ProviderEntry,
} from "../utils/modelSwitcher";
import { createHighlighter } from "shiki";

const highlighter = ref<any>(null);
if (typeof window !== "undefined") {
  createHighlighter({
    themes: ["github-light", "github-dark"],
    langs: ["typescript", "javascript", "json", "bash", "shell", "python"],
  }).then((h) => {
    highlighter.value = h;
  });
}

const isDarkMode = ref(false);
if (typeof window !== "undefined") {
  isDarkMode.value = window.matchMedia("(prefers-color-scheme: dark)").matches;

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleThemeChange = (e: MediaQueryListEvent) => {
    isDarkMode.value = e.matches;
  };

  mediaQuery.addEventListener("change", handleThemeChange);
  onUnmounted(() => {
    mediaQuery.removeEventListener("change", handleThemeChange);
  });
}

const props = defineProps<{
  code: string;
  output?: string;
  language?: string;
  filename?: string;
  providerModels?: ProviderEntry[];
}>();

const providers = ref(getProviders(props.providerModels));
const activeProviderIdx = ref(0);
const activeModelIdx = ref(0);
const copied = ref(false);

const apiKeyMap = {
  openai: { prop: "openAiApiKey", env: "OPENAI_API_KEY" },
  anthropic: { prop: "anthropicApiKey", env: "ANTHROPIC_API_KEY" },
  google: { prop: "geminiApiKey", env: "GEMINI_API_KEY" },
  xai: { prop: "xaiApiKey", env: "XAI_API_KEY" },
  deepseek: { prop: "deepseekApiKey", env: "DEEPSEEK_API_KEY" },
  ollama: { prop: "ollamaEndpoint", env: "OLLAMA_ENDPOINT" },
  bedrock: { prop: "awsAccessKey", env: "AWS_ACCESS_KEY" },
};

const detectedLanguage = computed(() => {
  if (props.language) return props.language;
  const inferred = inferLangFromFilename(props.filename);
  return inferred || "typescript";
});

const codeEl = ref<HTMLElement | null>(null);
const outputEl = ref<HTMLElement | null>(null);

const codeBlock = computed(() => {
  if (!props.code || !providers.value.length) return props.code || "";
  const provider = providers.value[activeProviderIdx.value]?.key || "openai";
  const model =
    providers.value[activeProviderIdx.value]?.models[activeModelIdx.value]
      ?.id || "gpt-4o-mini";
  let code = props.code;

  const defaultModels = {
    openai: "gpt-4o",
    anthropic: "claude-opus-4",
    google: "gemini-2.5-flash",
    deepseek: "deepseek-chat",
    xai: "grok-3",
    ollama: "deepseek-r1",
    bedrock: "claude-3-sonnet-20240229-v1:0"
  };

  if (model === "chat.v1") {
    const defaultModel = defaultModels[provider as keyof typeof defaultModels] || "model-name";

    if (provider === "bedrock") {
      code = code.replace(
        /\$\{provider\}\.\$\{model\}/g,
        `amazon:anthropic.chat.v1`
      );

      if (!code.includes("model:")) {
        code = code.replace(
          /useLlm\("([^"]+)"\)/g,
          `useLlm("$1", {\n  model: "claude-3-sonnet-20240229-v1:0" // specify a model from Bedrock\n})`
        );
      }
    } else {
      code = code.replace(
        /\$\{provider\}\.\$\{model\}/g,
        `${provider}.chat.v1`
      );

      if (!code.includes("model:")) {
        code = code.replace(
          /useLlm\("([^"]+)"\)/g,
          `useLlm("$1", {\n  model: "${defaultModel}" // specify a model\n})`
        );
      }
    }
  } else if (
    model.includes("anthropic.chat.v1") ||
    model.includes("meta.chat.v1")
  ) {
    code = code.replace(/\$\{provider\}\.\$\{model\}/g, `amazon:${model}`);

    const defaultBedrockModel = model.includes("anthropic")
      ? "claude-3-sonnet-20240229-v1:0"
      : "llama3-8b-instruct-v1:0";
    if (!code.includes("model:")) {
      code = code.replace(
        /useLlm\("([^"]+)"\)/g,
        `useLlm("$1", {\n  model: "${defaultBedrockModel}" // This is the model id from Bedrock\n})`
      );
    }
  } else if ((provider === "deepseek" || provider === "ollama") && !model.includes("chat.v1")) {
    // Special case for deepseek and ollama models - just use the model name without provider prefix
    code = code.replace(/\$\{provider\}\.\$\{model\}/g, `${model}`);

    if (code.includes("model:")) {
      code = code.replace(
        /useLlm\("([^"]+)",\s*{\s*model:[^}]+}\)/g,
        'useLlm("$1", {\n  // other options,\n  // no model needed, using ' +
          model +
          "\n})"
      );
    }
  } else {
    code = code.replace(/\$\{provider\}\.\$\{model\}/g, `${provider}.${model}`);

    if (code.includes("model:") && !model.includes("chat.v1")) {
      code = code.replace(
        /useLlm\("([^"]+)",\s*{\s*model:[^}]+}\)/g,
        'useLlm("$1", {\n  // other options,\n  // no model needed, using ' +
          model +
          "\n})"
      );
    }
  }

  if (code.includes("${apiKeyProp}") || code.includes("${apiKeyEnv}")) {
    const apiKey = apiKeyMap[provider as keyof typeof apiKeyMap] || { prop: "apiKey", env: "API_KEY" };
    code = code
      .replace(/\$\{apiKeyProp\}/g, apiKey.prop)
      .replace(/\$\{apiKeyEnv\}/g, apiKey.env);
  }

  return code;
});
const outputBlock = computed(() => props.output || "");

async function updateHighlight() {
  if (typeof window === "undefined" || !highlighter.value) return;

  try {
    await new Promise((resolve) => setTimeout(resolve, 10));

    if (codeEl.value) {
      const lang =
        detectedLanguage.value === "typescript"
          ? "typescript"
          : detectedLanguage.value || "javascript";

      const theme = isDarkMode.value ? "github-dark" : "github-light";

      const highlighted = highlighter.value.codeToHtml(codeBlock.value, {
        lang,
        theme,
        transformers: [
          {
            name: "line-numbers",
            options: { lineNumbers: false },
          },
          {
            name: "compact-lines",
            preprocess(code: any) {
              return code;
            },
            postprocess(html: any) {
              let processedHtml = html.replace(
                "<pre",
                '<pre data-compact="true"'
              );

              processedHtml = processedHtml.replace(
                /<span class="line"/g,
                '<span class="line" style="height:auto;line-height:1.1;margin:0;padding:0;"'
              );

              return processedHtml;
            },
          },
        ],
      });

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = highlighted;
      let codeHtml = tempDiv.querySelector("code")?.innerHTML || "";

      codeHtml = codeHtml.replace(/>\s*\n\s*</g, ">\n<");

      codeEl.value.innerHTML = codeHtml;
    }

    if (outputEl.value && outputBlock.value) {
      const lang =
        detectedLanguage.value === "typescript"
          ? "typescript"
          : detectedLanguage.value || "javascript";

      const theme = isDarkMode.value ? "github-dark" : "github-light";

      const highlighted = highlighter.value.codeToHtml(outputBlock.value, {
        lang,
        theme,
        transformers: [
          {
            name: "line-numbers",
            options: { lineNumbers: false },
          },
          {
            name: "compact-lines",
            preprocess(code: any) {
              return code;
            },
            postprocess(html: any) {
              let processedHtml = html.replace(
                "<pre",
                '<pre data-compact="true"'
              );

              processedHtml = processedHtml.replace(
                /<span class="line"/g,
                '<span class="line" style="height:auto;line-height:1.1;margin:0;padding:0;"'
              );

              return processedHtml;
            },
          },
        ],
      });

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = highlighted;
      let codeHtml = tempDiv.querySelector("code")?.innerHTML || "";

      codeHtml = codeHtml.replace(/>\s*\n\s*</g, ">\n<");

      outputEl.value.innerHTML = codeHtml;
    }
  } catch (error) {
    console.warn("Shiki highlighting failed:", error);
  }
}

watch(
  [
    codeBlock,
    outputBlock,
    activeProviderIdx,
    activeModelIdx,
    detectedLanguage,
    isDarkMode,
    highlighter,
  ],
  async () => {
    await nextTick();
    for (let i = 0; i < 3; i++) {
      if (highlighter.value) {
        await updateHighlight();
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  },
  { immediate: true }
);

onMounted(async () => {
  await nextTick();
  for (let i = 0; i < 3; i++) {
    if (highlighter.value) {
      await updateHighlight();
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
});

function copyCode() {
  const el = document.createElement("textarea");
  el.value = codeBlock.value;
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1200);
}
</script>

<style scoped>
.switcher-root {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  margin: 0 auto;
  border-radius: 8px;
  min-height: 400px;
  height: auto;
  width: 100%;
  max-width: 720px;
  gap: 12px;
  background-color: var(--vp-c-bg-soft);
  font-family: var(--vp-font-family-mono);
  overflow: hidden;
  transition: background-color 0.5s;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  --vp-c-tab-active-bg: #f8f8fa;
  --vp-c-tab-hover-bg: #f0f0f2;
  --vp-c-tab-active-text: #818cf8;
  --vp-c-tab-inactive-text: #6b7280;
}
.provider-tabs {
  display: flex;
  gap: 8px;
  margin: 0;
  padding: 0;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
.provider-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 100px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  opacity: 0.85;
  transition: all 0.2s ease;
  position: relative;
  white-space: nowrap;
  flex: 0 0 auto;
  gap: 6px;
}
.provider-tab.active {
  background: var(--vp-c-brand-dimm);
  color: #818cf8;
  opacity: 1;
  font-weight: 700;
  z-index: 2;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
}
.provider-tab:hover:not(.active) {
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-brand);
  opacity: 0.95;
}
.provider-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}
.provider-name {
  font-weight: 600;
  font-size: 15px;
}
.model-tabs {
  display: flex;
  gap: 4px;
  margin: 0;
  margin-bottom: 0;
  overflow-x: auto;
  padding: 0;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
  height: 26px;
  &::-webkit-scrollbar {
    display: none;
  }
}
.model-tab {
  background: none;
  border: none;
  border-radius: 0;
  padding: 0 8px;
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  opacity: 0.8;
  transition: all 0.2s ease;
  outline: none;
  text-decoration: none;
  white-space: nowrap;
  flex: 0 0 auto;
  height: 26px;
  line-height: 26px;
}
.model-tab.active {
  color: var(--vp-c-brand);
  opacity: 1;
  font-weight: 600;
  text-decoration: none;
  box-shadow: inset 0 -2px 0 var(--vp-c-brand);
}
.model-tab:hover:not(.active),
.model-tab:focus-visible:not(.active) {
  color: var(--vp-c-brand);
  opacity: 0.9;
  text-decoration: none;
}
.model-tab.deprecated > span:first-child {
  text-decoration: line-through;
  opacity: 0.7;
}
.deprecated-badge {
  margin-left: 6px;
  padding: 0 6px;
  font-size: 10px;
  line-height: 16px;
  border-radius: 3px;
  background: var(--vp-c-warning-soft, rgba(234, 179, 8, 0.16));
  color: var(--vp-c-warning-1, #b45309);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}
.code-area {
  margin-top: 5px;
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  background-color: var(--vp-code-block-bg);
  border-radius: 8px;
  overflow: hidden;
}
.code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--vp-c-bg-alt);
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  margin-bottom: 0;
}
.copy-btn.copied .copy-icon {
  color: #4caf50;
}
.copy-btn .copy-icon.copied {
  color: #4caf50;
}

.code-block,
.output-block {
  margin: 0;
  padding: 4px 8px;
  font-size: 13px;
  line-height: 1.1;
  flex: 1;
  overflow-x: auto;
  background: transparent;
  border-radius: 8px;
  font-family: var(
    --vp-font-family-mono,
    "Fira Mono",
    "Menlo",
    "Monaco",
    "Consolas",
    "Liberation Mono",
    "Courier New",
    monospace
  );
  border: none;
  min-height: 360px;
  display: flex;
  flex-direction: column;
  text-align: left;
}

.code-block.vp-code-block-switcher,
.output-block.vp-code-block-switcher {
  tab-size: 2;
  font-family:
    ui-monospace,
    SFMono-Regular,
    SF Mono,
    Menlo,
    Consolas,
    monospace;
  -webkit-font-smoothing: auto;
  color: var(--vp-c-text-1);
  background-color: var(--vp-code-block-bg);
  transition: background-color 0.3s;
  padding: 0.25em;
}

.code-block.vp-code-block-switcher code,
.output-block.vp-code-block-switcher code {
  font-size: 13px;
  line-height: 1.1;
  white-space: pre;
  word-spacing: normal;
  word-break: normal;
  word-wrap: normal;
  font-feature-settings: normal;
  letter-spacing: normal;
}
.code-block .line,
.output-block .line {
  display: block;
  min-height: 1.1em;
  height: auto;
  padding: 0 !important;
  margin: 0 !important;
  margin-bottom: 0 !important;
  margin-top: 0 !important;
  line-height: 1.1 !important;
}
.switcher-root code[class*="language-"] .token,
.hero-code-container code[class*="language-"] .token {
  background: transparent;
  text-shadow: none;
  margin: 0;
  padding: 0;
  border-radius: 0;
  display: inline;
  box-shadow: none;
}
.dark .switcher-root {
  --vp-c-bg: #18181a;
  --vp-c-bg-soft: #1e1e20;
  --vp-c-bg-alt: #27272a;
  --vp-c-text-1: #fff;
  --vp-c-text-code: #e6edf3;
  --vp-c-brand-1: #333;
  --vp-c-brand-2: #818cf8;
  --vp-c-text-code: #f1f5f9;
  --vp-c-tab-active-bg: #27272a;
  --vp-c-tab-hover-bg: #3f3f46;
  --vp-c-tab-active-text: #818cf8;
  --vp-c-tab-inactive-text: #fff;
}

.provider-tab {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-tab-inactive-text);
}
.provider-tab.active {
  background: var(--vp-c-tab-active-bg);
  color: var(--vp-c-tab-active-text);
  font-weight: 700;
  opacity: 1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
  z-index: 2;
  transform: translateY(-1px);
}
.provider-tab:hover:not(.active) {
  background: var(--vp-c-tab-hover-bg);
  color: var(--vp-c-tab-active-text);
  opacity: 0.95;
}

.code-header {
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-2, #aaa);
}

.code-actions {
  position: absolute;
  top: 0;
  right: 0;
  margin: 6px 6px 0 0;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 3;
  background: var(--vp-c-bg-soft);
  padding: 3px 6px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}
.code-area:hover .code-actions,
.code-area:focus-within .code-actions {
  opacity: 1;
  pointer-events: auto;
}
.copy-btn:hover,
.copy-btn:focus-visible {
  color: var(--vp-c-brand);
  background-color: var(--vp-c-bg);
  opacity: 1;
}
.copy-btn .copy-icon {
  width: 20px;
  height: 20px;
}
@media (max-width: 900px) {
  .switcher-root {
    width: 100%;
    max-width: 100vw;
    padding: 10px;
    margin: 0;
    border-radius: 8px;
  }
  
  .provider-tabs {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    padding-bottom: 8px;
    margin-bottom: 0;
    gap: 6px;
  }
  
  .provider-tab {
    min-width: 100px;
    font-size: 13px;
    padding: 6px 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .provider-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
  }
  
  .code-block,
  .output-block {
    padding: 12px;
    font-size: 13px;
    text-align: left;
  }
}
@media (max-width: 768px) {
  .switcher-root {
    padding: 12px 8px;
    margin: 0;
    border-radius: 8px;
    min-height: auto;
    height: 100%;
    gap: 8px;
  }
}

@media (max-width: 640px) {
  .switcher-root {
    padding: 8px;
    gap: 4px;
    min-height: 380px;
    width: 100vw;
    margin-left: -16px;
    margin-right: -16px;
    border-radius: 0;
  }

  .provider-tab {
    min-width: 90px;
    font-size: 12px;
    padding: 5px 8px;
  }

  .provider-logo {
    width: 16px;
    height: 16px;
    margin-right: 4px;
  }

  .provider-name {
    font-size: 12px;
    line-height: 1;
  }

  .model-tabs {
    height: 26px;
    margin-bottom: 4px;
  }

  .model-tab {
    min-width: auto;
    font-size: 12px;
    padding: 0 8px;
  }

  .code-block,
  .output-block {
    padding: 8px;
    font-size: 12px;
    line-height: 1.4;
    min-height: 300px;
    text-align: left;
  }

  .code-actions {
    top: 8px;
    right: 8px;
    margin: 0;
    background: transparent;
    box-shadow: none;
  }

  .copy-btn {
    padding: 4px;
  }

  .copy-btn .copy-icon {
    width: 16px;
    height: 16px;
  }
}
</style>
