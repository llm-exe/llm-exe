---
provider: openai.chat-mock.v1
system: You are a helpful summarizer.
parser: string
data:
  text: hello world
---
Summarize: {{text}}
