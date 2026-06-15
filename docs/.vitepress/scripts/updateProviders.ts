#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";

import { openai } from "@/llm/config/openai";
import { anthropic } from "@/llm/config/anthropic";
import { google } from "@/llm/config/google";
import { bedrock } from "@/llm/config/bedrock";
import { xai } from "@/llm/config/x";
import { ollama } from "@/llm/config/ollama";
import { deepseek } from "@/llm/config/deepseek";
import { Config } from "@/types";

interface ModelEntry {
  id: string;
  shorthand: string;
  deprecated?: true;
  message?: string;
}

interface ProviderOut {
  key: string;
  name: string;
  logo: string;
  models: ModelEntry[];
}

const providerLogos: Record<string, string> = {
  openai: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142-.0852 4.783-2.7582a.7712.7712 0 0 0 .7806 0l5.8428 3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" fill="#00A67E"/>
  </svg>`,
  anthropic: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#FF6B35"/>
  </svg>`,
  google: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>`,
  deepseek: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#6366F1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  xai: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#000000"/>
  </svg>`,
  ollama: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#FF6B35"/>
  </svg>`,
  bedrock: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#FF9900" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
};

interface ProviderSpec {
  key: string;
  name: string;
  configs: Record<string, Config<any>>;
  stripPrefix: string;
}

const providerSpecs: ProviderSpec[] = [
  {
    key: "openai",
    name: "OpenAI",
    configs: openai,
    stripPrefix: "openai.",
  },
  {
    key: "anthropic",
    name: "Anthropic",
    configs: anthropic,
    stripPrefix: "anthropic.",
  },
  {
    key: "bedrock",
    name: "AWS Bedrock",
    configs: bedrock,
    stripPrefix: "amazon:",
  },
  {
    key: "google",
    name: "Google",
    configs: google,
    stripPrefix: "google.",
  },
  {
    key: "deepseek",
    name: "DeepSeek",
    configs: deepseek,
    stripPrefix: "deepseek.",
  },
  { key: "xai", name: "xAI", configs: xai, stripPrefix: "xai." },
  { key: "ollama", name: "Ollama", configs: ollama, stripPrefix: "ollama." },
];

function buildProvider(spec: ProviderSpec): ProviderOut {
  const models: ModelEntry[] = [];

  for (const [shorthand, cfg] of Object.entries(spec.configs)) {
    if (shorthand.includes("chat-mock")) continue;

    const id = shorthand.startsWith(spec.stripPrefix)
      ? shorthand.slice(spec.stripPrefix.length)
      : shorthand;

    const entry: ModelEntry = { id, shorthand };
    if (cfg.deprecated) {
      entry.deprecated = true;
      entry.message = cfg.deprecated.message;
    }
    models.push(entry);
  }

  // Preserve the "chat.v1" sentinel tab the UI relies on.
  // For providers that don't expose a literal `.chat.v1` shorthand (bedrock),
  // prepend a synthetic entry so the docs widget keeps working.
  if (!models.some((m) => m.id === "chat.v1")) {
    models.unshift({ id: "chat.v1", shorthand: `${spec.key}.chat.v1` });
  } else {
    // Move chat.v1 to the front.
    const idx = models.findIndex((m) => m.id === "chat.v1");
    const [chatV1] = models.splice(idx, 1);
    models.unshift(chatV1);
  }

  // Stable secondary ordering: active first, deprecated last (chat.v1 stays first).
  const [first, ...rest] = models;
  rest.sort((a, b) => {
    const da = a.deprecated ? 1 : 0;
    const db = b.deprecated ? 1 : 0;
    return da - db;
  });

  return {
    key: spec.key,
    name: spec.name,
    logo: providerLogos[spec.key],
    models: [first, ...rest],
  };
}

const providers = providerSpecs.map(buildProvider);

const missing = providers.filter((p) => p.models.length === 0);
if (missing.length > 0) {
  console.error(
    `❌ Provider extraction yielded zero models for: ${missing
      .map((p) => p.key)
      .join(", ")}`
  );
  process.exit(1);
}

const outputPath = path.join(__dirname, "../utils/providers.json");
fs.writeFileSync(outputPath, JSON.stringify(providers, null, 2) + "\n");

console.log(`✅ Updated providers.json with ${providers.length} providers:`);
providers.forEach((p) => {
  const dep = p.models.filter((m) => m.deprecated).length;
  console.log(
    `  - ${p.name}: ${p.models.length} models${
      dep ? ` (${dep} deprecated)` : ""
    }`
  );
});
