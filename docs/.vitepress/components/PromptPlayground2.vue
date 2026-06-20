<template>
  <div v-if="ready" class="grid-wrap">
    <div class="grid-left-side">
      <div>
        <!-- <div><button @click="createNewPrompt">Reset</button></div> -->
        <!-- <PromptMessage
            v-for="(message, index) in messages"
            :message="message"
            :index="index"
          /> -->

        <!-- start add messages -->
        <fieldset class="left-side-section" style="width: 100%; position: relative">
          <legend class="input-label">Add Messages</legend>
          <div style="width: 100%">
            <label for="playground2-new-role" class="visually-hidden">
              Message role
            </label>
            <select
              id="playground2-new-role"
              v-model="newMessage.role"
              style="width: 100%; padding: 3px 8px"
            >
              <option value="system">System</option>
              <option value="assistant">Assistant</option>
              <option value="user">User</option>
            </select>
            <label for="playground2-new-content" class="visually-hidden">
              Message content
            </label>
            <textarea
              id="playground2-new-content"
              style="width: 100%; padding: 3px 8px"
              v-model="newMessage.content"
            />
          </div>

          <button
            type="button"
            class="add-message-button"
            @click="addMessage"
            style="padding: 1px 4px; background: #333; width: 100%"
          >
            Add
          </button>
        </fieldset>
        <!-- end add messages -->

        <!-- start options -->

        <fieldset class="left-side-section">
          <legend class="input-label">Options</legend>

          <div>
            <label for="playground2-prompt-type">Prompt Type: </label>
            <select id="playground2-prompt-type" v-model="type">
              <option value="chat">chat</option>
              <option value="text">text</option>
            </select>
          </div>
          <div>
            <label for="playground2-allow-unsafe">
              <input
                id="playground2-allow-unsafe"
                type="checkbox"
                v-model="options.allowUnsafeUserTemplate"
              />
              Allow Unsafe User Template
            </label>
          </div>
        </fieldset>

        <!-- end options -->
      </div>
      <div>
        <label for="playground2-json" class="input-label">
          Template input (JSON)
        </label>
        <div>
          <textarea
            id="playground2-json"
            style="width: 100%; padding: 3px 8px; min-height: 200px"
            v-model="json"
          ></textarea>
        </div>
      </div>
    </div>
    <div class="grid-right-side">
      <!--
        ARIA tabs pattern. The panel below is labelled by the active tab via
        aria-labelledby. Keyboard arrow-key navigation between tabs is a
        known gap; tabs are reachable via Tab and activated with Enter/Space.
        Follow-up tracked separately.
      -->
      <div class="tabs-labels" role="tablist" aria-label="Playground output">
        <button
          type="button"
          role="tab"
          id="pp2-tab-messages"
          aria-controls="pp2-tabpanel"
          :aria-selected="activeTab === 'messages'"
          :tabindex="activeTab === 'messages' ? 0 : -1"
          style="padding: 2px 3px; cursor: pointer"
          class="tabs-label"
          :class="activeTab === 'messages' ? 'active' : ''"
          @click="activeTab = 'messages'"
        >
          messages
        </button>
        <button
          type="button"
          role="tab"
          id="pp2-tab-options"
          aria-controls="pp2-tabpanel"
          :aria-selected="activeTab === 'options'"
          :tabindex="activeTab === 'options' ? 0 : -1"
          style="padding: 2px 3px; cursor: pointer"
          class="tabs-label"
          :class="activeTab === 'options' ? 'active' : ''"
          @click="activeTab = 'options'"
        >
          options
        </button>
        <button
          type="button"
          role="tab"
          id="pp2-tab-prompt"
          aria-controls="pp2-tabpanel"
          :aria-selected="activeTab === 'prompt'"
          :tabindex="activeTab === 'prompt' ? 0 : -1"
          style="padding: 2px 3px; cursor: pointer"
          class="tabs-label"
          :class="activeTab === 'prompt' ? 'active' : ''"
          @click="activeTab = 'prompt'"
        >
          prompt
        </button>
      </div>
      <div
        id="pp2-tabpanel"
        role="tabpanel"
        :aria-labelledby="`pp2-tab-${activeTab}`"
        style="padding: 32px; border: 1px solid #333; background-color: black"
      >
        <pre v-if="activeTab === 'options'">{{ options }}</pre>
        <pre v-if="activeTab === 'messages'">{{ output }}</pre>
        <pre v-if="activeTab === 'prompt'">{{ prompt }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, nextTick } from "vue";
import { useLlmExePrompt } from "./useLlmExePrompt";

const activeTab = ref("messages");

const data = {
  name: "Greg",
  person: {
    firstName: "Greg",
  },
};
const json = ref(JSON.stringify(data, null, 2));

const newMessage = ref({
  content: "",
  role: "user",
});

function addMessage() {
  const message = {
    content: newMessage.value.content,
    role: newMessage.value.role,
  };

  add(newMessage.value.role, newMessage.value.content);

  newMessage.value.content = "";

  if (message?.role === "system") {
    newMessage.value.role = "user";
  } else {
    newMessage.value.role = message?.role || "user";
  }
}

const { ready, prompt, options, type, add, reset } = useLlmExePrompt();

const messages = computed(() => {
  if (!prompt.value) return [];
  return prompt.value.messages || [];
});

const output = computed(() => {
  if (!prompt.value) return "";
  let parsed = {};
  try {
    parsed = JSON.parse(json.value);

    console.log("hellooooo", parsed);
    return prompt.value.format(parsed);
  } catch (e) {
    console.log("errr");
    return "";
  }
});

// onMounted(() => {
//   ready.value = false;
//   setTimeout(() => {
//     reset()
//     ready.value = true;
//     console.log("ready", prompt);
//     //   createNewPrompt();
//   }, 500);
// });
</script>
<style scoped>
.grid-wrap {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.grid-left-side {
  grid-column: 1;
  margin-right: 60px;
}
.grid-right-side {
  grid-column: 2;
}

.left-side-section {
  margin-bottom: 30px;
}

.input-label {
  font-weight: bold;
  font-size: 14px;
}

.tabs-labels {
  display: flex;
  justify-content: flex-end;
}

.tabs-label {
  opacity: 0.5;
}

.tabs-label:hover {
  opacity: 0.8;
}

.tabs-label.active {
  background-color: #333;
  opacity: 1;
  color: white;
}

.tabs-label {
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.tabs-label:focus-visible {
  outline: 2px solid var(--vp-c-brand, #818cf8);
  outline-offset: 2px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
