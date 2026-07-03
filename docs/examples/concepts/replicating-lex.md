---
title: "Replicate Amazon Lex with LLMs in TypeScript | llm-exe"
description: "Rebuild Amazon Lex-style chatbots in TypeScript with composable LLM executors that identify intent, extract slots, confirm, and generate responses."
---

# Replicating Lex

This is a non-exhaustive overview on how to replace some of the core concepts of Amazon Lex with a series of LLM executor functions.

We will aim to replace the following key components with individual LLM calls:
- Identify Intent
- Extract Slots
- Confirm Intent
- Response Generator

The challenge will come down to how you choose to:

1. Manage the intents/slots
2. Manage state
3. Handle the flow

## Identify Intent
To identify intent, we ask an LLM to identify what the intent of the conversation is. Simple and powerful! There is a little more to it than that, but not much. To start, we pre-define the intents that we expect (or want) to match. These get fed into the prompt and become the options the LLM can choose from. If the LLM can not identify the intent, the fallback is 'unknown'. This way, we can easily classify if the conversation matches something you planned for, or not.

We can also use some tricks to help get the best match:
- The prompt can also contain a description to help the LLM match to the prompt.
- Like Lex, you can tell the LLM to respond with its 'confidence'.
- To build on this, we tell the LLM to go through all the intents we give it, and rate each by confidence, and bring us back to top 3.

These are all prompt tricks. They are tips, not rules. Experiment yourself with what works.

Note: See [intent](/examples/bots/intent.html) for detailed example of the intent executor.


## Extract Slots
We'd use the result of the intent LLM to know which slots are available/required for the next step. Then, we'll ask the LLM if the specific information is included in the conversation.

Note: See [extract](/examples/bots/extract.html) for detailed example of the confirm executor.


## Confirm
To confirm the intent, you guessed it, we'll be asking an LLM if the user has confirmed! There are various ways to go about this, as it comes down to engineering a prompt that satisfies the requirement. For this example, I will use the validator LLM executor from this example.

The validator LLM executor takes a conversation, and a series of true/false statements, and asks the LLM to work through the statements and identify if they are true or false. Our LLM Executor has a custom output parser which will summarize this output into something easily usable.


Note: See [intent](/examples/bots/intent.html) for detailed example of the confirm executor.

## Response Generator
You can use a single LLM executor with some prompt templates to generate responses when you need to elicit intent, confirm, or carry on conversation.


## Putting it together

With these pieces, we can put together a proof of concept:

```typescript
import { identifyIntent } from "../other-example"
import { extractInformation } from "../another-example";
import { checkPolicy } from "policy-example"
import {  createDialogue } from "llm-exe";

// if you use history. See state/Dialogue
const chatHistory = createDialogue("chat");

// An example. 
const intentMap = {
    rent_car: {
        slots: {
            // slot schema
        }
    },
    book_hotel: {
        slots: {
            // slot schema
        } 
    },
    book_flight: {
        slots: {
            // slot schema
        }
    }
}


// get the intent
const { intent } = await identifyIntent({
    input,
    chatHistory: chatHistory.getHistory()
});


let fulfilled = false;
let confirmed = false;

if(intent === "unknown"){
    // return llm executor that deals with normal conversation, or unknown intents
    // This can just be a call to GPT4 with the whole conversation. It'll do okay to start.
}


// ok, we have a known intent.
// lets use it to tell the extractor what we're looking for
const { slots } = intentMap[intent];

// We provide the extractor the input, history, and slot schema
const extraction = await extractInformation({
    input,
    chatHistory: chatHistory.getHistory()
}, slots);

// now you should check slot values, validate slots, etc

// need a slot? Return an elicit slot LLM call

// all slots valid? Great! 

// this is another example of where it may help to manage state

// lets che
const didConfirm = await checkPolicy({
    mostRecentMessage: input,
    chatHistory: chatHistory.getHistory()
    statements: [
        "did the user explicitly confirm they wanted to rent a xxx on xxx?",
        "Did the assistant ask the user to confirm?"
    ]
});

// if did not confirm, ask them to confirm


// if did confirm, maybe its time to fulfill?


```

Tips:
- Will update with more.