import { defineConfig } from "vitepress";
// import { transformerTwoslash } from "@shikijs/vitepress-twoslash";

// https://vitepress.dev/reference/site-config
const SITE_URL = "https://llm-exe.com";
const SITE_DESCRIPTION =
  "llm-exe is a lightweight TypeScript package for building LLM-powered applications: typed prompts, output parsers, and composable executors that work with OpenAI, Anthropic, Google, and more.";

// Canonical URL forms: leaf pages are extensionless (/llm/openai), section
// indexes keep a trailing slash (/executor/). VitePress's dead-link checker
// requires the trailing-slash form for index links, so this split is
// load-bearing — don't "simplify" it to one shape.
function pagePathToCanonicalUrl(relativePath: string): string {
  const path = relativePath
    .replace(/(^|\/)index\.md$/, "$1")
    .replace(/\.md$/, "");
  return `${SITE_URL}/${path}`;
}

export default defineConfig({
  title: "llm-exe",
  // Page titles from frontmatter already carry branding ("... | llm-exe",
  titleTemplate: false,
  description: SITE_DESCRIPTION,
  lang: "en-US",
  cleanUrls: true,
  srcExclude: [
    "**/*.part.md",
    // empty placeholder — exclude until it has content
    "misc/llm-exe-aws-sfn.md",
  ],
  sitemap: {
    hostname: "https://llm-exe.com",
  },
  transformPageData(pageData) {
    const canonicalUrl = pagePathToCanonicalUrl(pageData.relativePath);
    const pageTitle =
      pageData.frontmatter?.title || pageData.title || "llm-exe";
    const pageDescription =
      pageData.frontmatter?.description ||
      pageData.description ||
      SITE_DESCRIPTION;

    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(
      ["link", { rel: "canonical", href: canonicalUrl }],
      ["meta", { property: "og:title", content: pageTitle }],
      ["meta", { property: "og:url", content: canonicalUrl }],
      ["meta", { property: "og:description", content: pageDescription }]
    );
  },
  head: [
    ["link", { rel: "icon", href: "https://assets.llm-exe.com/favicon.ico" }],
    [
      "meta",
      {
        property: "og:image",
        content: "https://assets.llm-exe.com/llm-exe-featured.jpg",
      },
    ],
    ["meta", { property: "og:locale", content: "en_US" } as any],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "llm-exe" }],
    [
      "script",
      {
        async: "",
        src: "https://www.googletagmanager.com/gtag/js?id=G-5YTJ8HRXNF",
      },
    ],
    [
      "script",
      { async: "", defer: "", src: "https://buttons.github.io/buttons.js" },
    ],
    [
      "script",
      {},
      `window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-5YTJ8HRXNF');`,
    ],
    ["script", { src: "https://assets.llm-exe.com/llm-exe-browser-utils.js" }],
  ],
  themeConfig: {
    logo: "https://assets.llm-exe.com/logo.png",
    nav: [
      {
        text: "Guide",
        items: [
          {
            text: "Getting Started",
            link: "/intro/install",
          },
          {
            text: "Installation",
            link: "/intro/install",
          },
          {
            text: "What's a LLM Function?",
            link: "/intro/what_is_llm_function",
          },
        ],
      },
      {
        text: "References",
        items: [
          {
            text: "Prompt",
            link: "/prompt/",
          },
          {
            text: "Parser",
            link: "/parser/",
          },
          {
            text: "State",
            link: "/state/",
          },
          {
            text: "LLM",
            link: "/llm/",
          },
          {
            text: "LLM Executor",
            link: "/executor/",
          },
          {
            text: "Embeddings",
            link: "/embeddings/",
          },
        ],
      },
      { text: "Examples", link: "/examples/" },
    ],

    sidebar: [
      {
        text: "Getting Started",
        link: "",
        collapsed: false,
        items: [
          {
            text: "Installation",
            link: "/intro/install",
            items: [],
          },
          {
            text: "Intro",
            link: "/intro/",
            items: [],
          },
          {
            text: "What's a LLM Function?",
            link: "/intro/what_is_llm_function",
            items: [],
          },
          {
            text: "Executor Function Syntax",
            link: "/examples/FunctionSyntax",
          },
        ],
      },
      {
        text: "LLM",
        link: "/llm/",
        collapsed: false,
        items: [
          {
            text: "Generic Options",
            link: "/llm/generic",
            items: [],
          },
          {
            text: "OpenAi",
            link: "/llm/openai",
            items: [],
          },
          {
            text: "Anthropic",
            link: "/llm/anthropic",
            items: [],
          },
          {
            text: "Google Gemini",
            link: "/llm/gemini",
            items: [],
          },
          {
            text: "AWS Bedrock",
            link: "/llm/bedrock/",
            items: [
              {
                text: "Anthropic",
                link: "/llm/bedrock/anthropic",
                items: [],
              },
              {
                text: "Meta",
                link: "/llm/bedrock/meta",
                items: [],
              },
            ],
          },
          {
            text: "xAI",
            link: "/llm/xai",
            items: [],
          },
          {
            text: "Ollama",
            link: "/llm/ollama",
            items: [],
          },
          {
            text: "Deepseek",
            link: "/llm/deepseek",
            items: [],
          },
          {
            text: "Custom Providers",
            link: "/llm/custom",
            items: [],
          },
          {
            text: "Deprecation Warnings",
            link: "/llm/deprecations",
            items: [],
          },
        ],
      },
      {
        text: "Prompt",
        collapsed: true,
        items: [
          {
            text: "Getting Started",
            link: "/prompt/",
            items: [],
          },
          {
            text: "Chat Prompt",
            link: "/prompt/chat",
            items: [],
          },
          {
            text: "Validation",
            link: "/prompt/validation",
            items: [],
          },
          {
            text: "Text Prompt",
            link: "/prompt/text",
            items: [],
          },

          {
            text: "Advanced Templates",
            link: "/prompt/advanced",
            items: [],
          },
          {
            text: "Why Handlebars?",
            link: "/prompt/why-handlebars",
            items: [],
          },
          // {
          //   text: "Playground",
          //   link: "/prompt/playground",
          //   items: [],
          // },
        ],
      },
      {
        text: "Parser",
        link: "/parser/",
        collapsed: true,
        items: [
          {
            text: "Getting Started",
            link: "/parser/",
          },
          {
            text: "Included Parsers",
            link: "/parser/included-parsers",
          },
          {
            text: "Custom Parsers",
            link: "/parser/custom",
          },
        ],
      },
      {
        text: "State",
        link: "/state/",
        collapsed: true,
        items: [
          {
            text: "Dialogue",
            link: "/state/dialogue",
          },
        ],
      },
      {
        text: "LLM Executor",
        collapsed: true,
        items: [
          {
            text: "Getting Started",
            link: "/executor/",
          },
          {
            text: "Options",
            link: "/executor/options",
          },
          {
            text: "ExecutionContext",
            link: "/executor/execution-context",
          },
          {
            text: "Functions (tools)",
            link: "/executor/openai-functions",
          },
          {
            text: "Callable Executor",
            link: "/callable/",
          },
          {
            text: "Hooks",
            link: "/executor/hooks",
          },
        ],
      },
      {
        text: "Embeddings",
        collapsed: true,
        items: [
          {
            text: "Getting Started",
            link: "/embeddings/",
          },
          {
            text: "OpenAi",
            link: "/embeddings/openai",
          },
          {
            text: "Amazon",
            link: "/embeddings/amazon",
          },
          {
            text: "Cohere (via Bedrock)",
            link: "/embeddings/cohere",
          },
        ],
      },
      {
        text: "Examples",
        link: "/examples/",
        collapsed: true,
        items: [
          {
            text: "Hello World",
            link: "/examples/bots/hello",
          },
          {
            text: "Write a Type-Safe LLM Function",
            link: "/examples/concepts/type-safe-llm-function",
          },
          {
            text: "Structured Output",
            items: [
              {
                text: "Yes/No Decisions",
                link: "/examples/bots/yes-no",
              },
              {
                text: "Extract Structured Data",
                link: "/examples/bots/extract",
              },
              {
                text: "Validate Statements",
                link: "/examples/bots/validator",
              },
              {
                text: "Working With JSON",
                link: "/examples/concepts/working-with-json",
              },
            ],
          },
          {
            text: "Classification & Routing",
            items: [
              {
                text: "Intent Classification",
                link: "/examples/bots/intent",
              },
              {
                text: "Conditional Logic and Branching",
                link: "/examples/chains/conditional-logic-with-llms",
              },
              {
                text: "Replicating Amazon Lex",
                link: "/examples/concepts/replicating-lex",
              },
            ],
          },
          {
            text: "Chaining & Composition",
            items: [
              {
                text: "Combine Two Executors",
                link: "/examples/combining",
              },
              {
                text: "Sequential Composition",
                link: "/examples/chains/sequential-composition",
              },
              {
                text: "Self-Refinement Loop",
                link: "/examples/chains/self-refinement",
              },
            ],
          },
          {
            text: "Code Generation",
            items: [
              {
                text: "Write Code from Spec",
                link: "/examples/bots/write-code-from-spec",
              },
              {
                text: "Write Tests from Code",
                link: "/examples/bots/write-tests-from-code",
              },
            ],
          },
          {
            text: "Agents & Tools",
            items: [
              {
                text: "ReAct: Search + Calculator",
                link: "/examples/react",
              },
            ],
          },
          {
            text: "Prompts",
            items: [
              {
                text: "Separate Prompts from Code",
                link: "/examples/prompt/separate-prompts-from-code",
              },
              {
                text: "Loading Prompts Remotely",
                link: "/examples/prompt/load-remote",
              },
            ],
          },
          {
            text: "Production Patterns",
            items: [
              {
                text: "Retries and Timeouts",
                link: "/examples/concepts/retries-and-timeouts",
              },
              {
                text: "LLM Calls in Lambda & Cron",
                link: "/examples/concepts/llm-in-lambda",
              },
              {
                text: "Prompt Injection Screening",
                link: "/examples/concepts/prompt-injection-screening",
              },
            ],
          },
        ],
      },
      {
        text: "Other",
        link: "",
        collapsed: true,
        items: [
          // SidebarItem
          // {
          //   text: "Comparing to Langchain",
          //   link: "/misc/comparing-langchain",
          // },
          {
            text: "v2 to v3 Migration",
            link: "/misc/v2-to-v3-migration-guide",
          },
          {
            text: "Error Handling",
            link: "/misc/errors",
          },
        ],
      },
    ],

    socialLinks: [
      {
        ariaLabel: "Medium",
        link: "https://medium.com/llm-exe",
        icon: {
          svg: `<svg viewBox="0 -55 256 256" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" preserveAspectRatio="xMidYMid" fill="currentColor"><g stroke-width="0"></g><g stroke-linecap="round" stroke-linejoin="round"></g><g> <g> <path d="M72.2009141,1.42108547e-14 C112.076502,1.42108547e-14 144.399375,32.5485469 144.399375,72.6964154 C144.399375,112.844284 112.074049,145.390378 72.2009141,145.390378 C32.327779,145.390378 0,112.844284 0,72.6964154 C0,32.5485469 32.325326,1.42108547e-14 72.2009141,1.42108547e-14 Z M187.500628,4.25836743 C207.438422,4.25836743 223.601085,34.8960455 223.601085,72.6964154 L223.603538,72.6964154 C223.603538,110.486973 207.440875,141.134463 187.503081,141.134463 C167.565287,141.134463 151.402624,110.486973 151.402624,72.6964154 C151.402624,34.9058574 167.562834,4.25836743 187.500628,4.25836743 Z M243.303393,11.3867175 C250.314,11.3867175 256,38.835526 256,72.6964154 C256,106.547493 250.316453,134.006113 243.303393,134.006113 C236.290333,134.006113 230.609239,106.554852 230.609239,72.6964154 C230.609239,38.837979 236.292786,11.3867175 243.303393,11.3867175 Z" fill="currentColor"> </path> </g> </g></svg>`,
        },
      },
      { icon: "github", link: "https://github.com/llm-exe/llm-exe" },
      { icon: "npm", link: "https://www.npmjs.com/package/llm-exe" },
    ],
  },
  markdown: {
    // codeTransformers: [transformerTwoslash()],
    theme: { light: "github-light-default", dark: "github-dark-default" },
  },
  vite: {
    css: {
      preprocessorOptions: {
        css: {
          additionalData: `@import "./theme/style.css";`,
        },
      },
    },
  },
});
