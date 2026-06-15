<template>
  <div id="model-shorthand-container" class="info custom-block">
    <div class="custom-block-title custom-block-title-default">INFO</div>
    <div>You can use the following models using this shorthand:</div>
    <ul>
      <li v-for="model in models" :key="model.id">
        <code>{{ props.provider }}.{{ model.id }}</code>
        <template v-if="model.deprecated">
          <span class="deprecated-badge">deprecated</span>
          <div v-if="model.message" class="deprecated-message">
            {{ model.message }}
          </div>
        </template>
      </li>
    </ul>
    <div v-if="hasDeprecated" class="deprecated-footnote">
      Deprecated shorthands still resolve and will continue to work for now, but
      the underlying provider may stop accepting them at any time. Migrate to a
      current shorthand when you can.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import providersData from "../utils/providers.json";
import type { ProviderEntry } from "../utils/modelSwitcher";

const props = defineProps<{
  provider: string;
}>();

const providers = providersData as ProviderEntry[];

const models = computed(() => {
  const provider = providers.find((p) => p.key === props.provider);
  if (!provider) return [];
  return provider.models.filter((m) => m.id !== "chat.v1");
});

const hasDeprecated = computed(() => models.value.some((m) => m.deprecated));
</script>

<style scoped>
.deprecated-badge {
  margin-left: 8px;
  padding: 1px 6px;
  font-size: 10px;
  line-height: 14px;
  border-radius: 3px;
  background: var(--vp-c-warning-soft, rgba(234, 179, 8, 0.16));
  color: var(--vp-c-warning-1, #b45309);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
  vertical-align: middle;
}
.deprecated-message {
  margin-top: 2px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.deprecated-footnote {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--vp-c-divider, rgba(60, 60, 67, 0.12));
  font-size: 13px;
  color: var(--vp-c-text-2);
}
</style>
