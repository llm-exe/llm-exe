import { defineConfig } from "vitepress";
// import { transformerTwoslash } from "@shikijs/vitepress-twoslash";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "llm-exe",
  description: "",
  lang: "en-US",
  cleanUrls: false,
  sitemap: {
    hostname: "https://llm-exe.com",
  },
  head: [
    [
      "link",
      { rel: "icon", href: "https://assets.llm-exe.com/favicon.ico" },
      { rel: "canonical", href: "https://llm-exe.com" } as any,
    ],
    [
      "meta",
      {
        property: "og:image",
        content: "https://assets.llm-exe.com/llm-exe-featured.jpg",
      },
    ],
    ["meta", { property: "og:locale", content: "en_US" } as any],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "Typescript LLM Utilities" }],
    ["meta", { property: "og:url", content: "https://llm-exe.com" }],
    ["meta", { property: "og:site_name", content: "llm-exe" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "A package that provides utilities, wrappers, and base abstractions to help make writing applications with llm-powered functions easier.",
      },
    ],
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
            link: "/intro/install.html",
          },
          {
            text: "Installation",
            link: "/intro/install.html",
          },
          {
            text: "What's a LLM Function?",
            link: "/intro/what_is_llm_function.html",
          },
        ],
      },
      {
        text: "References",
        items: [
          {
            text: "Prompt",
            link: "/prompt/index.html",
          },
          {
            text: "Parser",
            link: "/parser/index.html",
          },
          {
            text: "State",
            link: "/state/index.html",
          },
          {
            text: "LLM",
            link: "/llm/index.html",
          },
          {
            text: "LLM Executor",
            link: "/executor/index.html",
          },
          {
            text: "Embeddings",
            link: "/embeddings/index.html",
          },
        ],
      },
      { text: "Examples", link: "/examples" },
    ],

    sidebar: [
      {
        text: "Getting Started",
        link: "",
        collapsed: false,
        items: [
          {
            text: "Installation",
            link: "/intro/install.html",
            items: [],
          },
          {
            text: "Intro",
            link: "/intro/index.html",
            items: [],
          },
          {
            text: "What's a LLM Function?",
            link: "/intro/what_is_llm_function.html",
            items: [],
          },
          {
            text: "Executor Function Syntax",
            link: "/examples/FunctionSyntax.html",
          },
        ],
      },
      {
        text: "LLM",
        link: "/llm/index.html",
        collapsed: false,
        items: [
          {
            text: "Generic Options",
            link: "/llm/generic.html",
            items: [],
          },
          {
            text: "OpenAi",
            link: "/llm/openai.html",
            items: [],
          },
          {
            text: "Anthropic",
            link: "/llm/anthropic.html",
            items: [],
          },
          {
            text: "Google Gemini",
            link: "/llm/gemini.html",
            items: [],
          },
          {
            text: "AWS Bedrock",
            link: "/llm/bedrock/index.html",
            items: [
              {
                text: "Anthropic",
                link: "/llm/bedrock/anthropic.html",
                items: [],
              },
              {
                text: "Meta",
                link: "/llm/bedrock/meta.html",
                items: [],
              },
            ],
          },
          {
            text: "xAI",
            link: "/llm/xai.html",
            items: [],
          },
          {
            text: "Ollama",
            link: "/llm/ollama.html",
            items: [],
          },
          {
            text: "Deepseek",
            link: "/llm/deepseek.html",
            items: [],
          },
          {
            text: "Custom Providers",
            link: "/llm/custom.html",
            items: [],
          },
          {
            text: "Deprecation Warnings",
            link: "/llm/deprecations.html",
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
            link: "/prompt/index.html",
            items: [],
          },
          {
            text: "Chat Prompt",
            link: "/prompt/chat.html",
            items: [],
          },
          {
            text: "Validation",
            link: "/prompt/validation.html",
            items: [],
          },
          {
            text: "Text Prompt",
            link: "/prompt/text.html",
            items: [],
          },

          {
            text: "Advanced Templates",
            link: "/prompt/advanced.html",
            items: [],
          },
          {
            text: "Why Handlebars?",
            link: "/prompt/why-handlebars.html",
            items: [],
          },
          // {
          //   text: "Playground",
          //   link: "/prompt/playground.html",
          //   items: [],
          // },
        ],
      },
      {
        text: "Parser",
        link: "/parser/index.html",
        collapsed: true,
        items: [
          {
            text: "Getting Started",
            link: "/parser/index.html",
          },
          {
            text: "Included Parsers",
            link: "/parser/included-parsers.html",
          },
          {
            text: "Custom Parsers",
            link: "/parser/custom.html",
          },
        ],
      },
      {
        text: "State",
        link: "/state/index.html",
        collapsed: true,
        items: [
          {
            text: "Dialogue",
            link: "/state/dialogue.html",
          },
        ],
      },
      {
        text: "LLM Executor",
        collapsed: true,
        items: [
          {
            text: "Getting Started",
            link: "/executor/index.html",
          },
          {
            text: "Options",
            link: "/executor/options.html",
          },
          {
            text: "ExecutionContext",
            link: "/executor/execution-context.html",
          },
          {
            text: "Functions (tools)",
            link: "/executor/openai-functions.html",
          },
          {
            text: "Callable Executor",
            link: "/callable/index.html",
          },
          {
            text: "Hooks",
            link: "/executor/hooks.html",
          },
        ],
      },
      {
        text: "Embeddings",
        collapsed: true,
        items: [
          {
            text: "Getting Started",
            link: "/embeddings/index.html",
          },
          {
            text: "OpenAi",
            link: "/embeddings/openai.html",
          },
          {
            text: "Amazon",
            link: "/embeddings/amazon.html",
          },
          {
            text: "Cohere (via Bedrock)",
            link: "/embeddings/cohere.html",
          },
        ],
      },
      {
        text: "Examples",
        link: "/examples",
        collapsed: true,
        items: [
          // {
          //   text: "Concepts",
          //   link: "",
          //   items: [
          // {
          //   text: "Executor Function Syntax",
          //   link: "/examples/FunctionSyntax.html",
          // },
          // {
          //   text: "Simple Combining",
          //   link: "/examples/combining.html",
          // },
          // {
          //   text: "ReAct: Search + Calculator",
          //   link: "/examples/react.html",
          // },
          // {},
          //   ],
          // },
          // {
          //   text: "LLM Functions",
          //   link: "/examples/FunctionSyntax",
          // },
          // {
          //   text: "Executor Function Syntax",
          //   link: "/examples/FunctionSyntax",
          // },
          // {
          //   text: "LLM Functions",
          //   link: "",
          //   items: [
          //     {
          //       text: "Hello World",
          //       link: "/examples/bots/hello.html",
          //     },
          //     {
          //       text: "Validator",
          //       link: "/examples/bots/validator.html",
          //     },
          //     {
          //       text: "Intent",
          //       link: "/examples/bots/intent.html",
          //     },
          //     {
          //       text: "Extractor",
          //       link: "/examples/bots/extract.html",
          //     },
          //   ],
          // },
          // {
          //   text: "Misc",
          //   link: "",
          //   items: [
          //     {
          //       text: "Working With JSON",
          //       link: "/examples/concepts/working-with-json.html",
          //     },
          //     {
          //       text: "Replicating Lex",
          //       link: "/examples/concepts/replicating-lex.html",
          //     },
          //   ],
          // },
          // {
          //   text: "ReAct: Search + Calculator",
          //   link: "/examples/react",
          // },
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
          //   link: "/misc/comparing-langchain.html",
          // },
          {
            text: "v2 to v3 Migration",
            link: "/misc/v2-to-v3-migration-guide.html",
          },
          {
            text: "Error Handling",
            link: "/misc/errors.html",
          },
          {
            text: "Working With JSON",
            link: "/examples/concepts/working-with-json.html",
          },
          {
            text: "Replicating Lex",
            link: "/examples/concepts/replicating-lex.html",
          },
        ],
      },
    ],

    socialLinks: [
      {
        ariaLabel: "Medium",
        link: "https://medium.com/llm-exe",
        icon: {
          svg: `<svg viewBox="0 -55 256 256" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" preserveAspectRatio="xMidYMid" fill="currentColor"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path d="M72.2009141,1.42108547e-14 C112.076502,1.42108547e-14 144.399375,32.5485469 144.399375,72.6964154 C144.399375,112.844284 112.074049,145.390378 72.2009141,145.390378 C32.327779,145.390378 0,112.844284 0,72.6964154 C0,32.5485469 32.325326,1.42108547e-14 72.2009141,1.42108547e-14 Z M187.500628,4.25836743 C207.438422,4.25836743 223.601085,34.8960455 223.601085,72.6964154 L223.603538,72.6964154 C223.603538,110.486973 207.440875,141.134463 187.503081,141.134463 C167.565287,141.134463 151.402624,110.486973 151.402624,72.6964154 C151.402624,34.9058574 167.562834,4.25836743 187.500628,4.25836743 Z M243.303393,11.3867175 C250.314,11.3867175 256,38.835526 256,72.6964154 C256,106.547493 250.316453,134.006113 243.303393,134.006113 C236.290333,134.006113 230.609239,106.554852 230.609239,72.6964154 C230.609239,38.837979 236.292786,11.3867175 243.303393,11.3867175 Z" fill="currentColor"> </path> </g> </g></svg>`,
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
