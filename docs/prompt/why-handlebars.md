# Why Handlebars?

When preparing your prompts, it may seem easier to use native Javascript template literals within your prompts instead of utilizing Handlebars. It is suggested you embrace the Handlebars approach.

### 1. Separation of Logic and Data

Handlebars templates keep presentation (template) separate from code and data, promoting clearer separation of concerns. With template literals, you often end up mixing logic and string construction in your JavaScript.

✅ **Using Handlebars the llm-exe way**

```ts
// the prompt is just a string!
const instruction = `You are answering a user's question.

{{#if user.isFirstTime}}
Give a detailed beginner-friendly answer.
{{else}}
Give a short expert-level summary.
{{/if}}

Question:
{{question}}`;

const prompt = createPrompt("text", instruction);

// data gets passed in later, when we need to render the template
// these values do not need to be defined when crafting the prompt
const formatted = prompt.format({
  user: { isFirstTime: true },
  question: "What is machine learning?",
});
```

❌ **The template literal way**

The data you are referencing in your prompt must be in the same scope - it must be defined when the prompt is defined.

```ts
const user = { isFirstTime: true };
const question = "What is machine learning?";

const output = `
You are answering a user's question.

${
  user.isFirstTime
    ? "Give a detailed beginner-friendly answer."
    : "Give a short expert-level summary."
}

Question:
${question}`;
```

::: tip
Since your template is disconnected from your data, you can even store your prompts in separate files - for example import them from text files - like from an s3 bucket.
:::

### 2. Logic Helpers

Handlebars supports built-in helpers like `if`, `each`, and even custom helpers, all directly inside the template. This lets you use loops, conditions, and transformations which are not possible with vanilla template literals.

✅ **Using Handlebars the llm-exe way**

The prompt is just a string. So clean!

```
{{#if user.isResearcher}}
Summarize the following studies in a formal tone.
{{else}}
Summarize the following studies in simple language.
{{/if}}

Studies to summarize:
{{#each studies}}
- {{this}}
{{/each}}
```

❌ **The template literal way**

🤮

```js
const output = `
${user.isResearcher
  ? "Summarize the following studies in a formal tone."
  : "Summarize the following studies in simple language."
}

Studies to summarize:
${studies.map((study) => `- ${study}`).join("\n")}`;
```


### 3. Reusability via Partials

Handlebars allows you to define **partials** reusable chunks of template. This is great for shared layouts or repeated sections, and is not natively supported by template literals.

```ts
utils.registerPartials([{ name: 'greeting', template: `Hello {{name}}!` }])

const instruction = `
{{> greeting name=userName}}

Please answer the following questions:
- What are your goals for the next 6 months?
- How can we support you best?`
```

With template literals - have to manually build and call functions with js/ts:

```ts
function greeting(name) {
  return `Hello ${name}!`;
}

const output = `
  ${greeting("Greg")}

Please answer the following questions:
  - What are your goals for the next 6 months?
  - How can we support you best?`;
```

### 4. Harness llm-exe prompt types

llm-exe prompts are designed with Handlebars in mind - by allowing you to declare types when defining your prompt. The types get inferred when calling the `format` method on the prompt and when using the prompt in an [llm-executor](/executor/) and calling `execute`.

```ts
interface SomePromptInput {
  user: {
    isAdmin: boolean;
    name: string;
  };
  tasks: string[];
}

const prompt = createChatPrompt<SomePromptInput>(`Your name is {{agentName}}.

You will help the user learn about {{topic}}.`);
```

![Screenshot of a code editor showing the createChatPrompt generic accepting a typed input object, with autocomplete suggesting agentName, topic, user, and tasks fields](/images/prompt-showing-types-being-passed-in.jpg)

And an error if you pass in the wrong input:

![Screenshot of the same prompt call with the wrong input shape, showing a TypeScript compiler error highlighting the missing required properties](/images/prompt-showing-types-being-passed-in-with-error.jpg)

### More Readable and Maintainable

Whether you are working with simple, or complex templates, Handlebars syntax is often more readable, especially for non-developers or when templates are maintained separately from code.
