<template>
  <div class="filter-row" role="group" aria-label="Example filters">
    <button
      v-if="values.length"
      type="button"
      @click="clearFilter"
      class="filter-item clear"
    >
      clear filter
    </button>
    <button
      type="button"
      @click="setFilter(group.key)"
      class="filter-item"
      :class="{
        active: values.includes(group.key),
      }"
      :aria-pressed="values.includes(group.key)"
      v-for="group in allExamples.groups"
      :key="group.title"
    >
      {{ group.title }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import allExamples from "../data/examples.json";
import { ref } from "vue";

const values = ref<string[]>([]);

const emit = defineEmits(["change"]);

function clearFilter() {
  values.value = [];
  emit("change", values.value);
}
function setFilter(group: string) {
  if (values.value.includes(group)) {
    values.value = values.value.filter((item) => item !== group);
  } else {
    values.value.push(group);
  }
  emit("change", values.value);
}
</script>

<style lang="css" scoped>
.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
}

.filter-item {
  padding: 2px 4px;
  font-size: 14px;
  border-radius: 4px;
  background: transparent;
  border: 1px solid transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: all 0.3s ease;
}
.filter-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}
.filter-item:focus-visible {
  outline: 2px solid var(--vp-c-brand, #818cf8);
  outline-offset: 2px;
}
.filter-item.active {
  color: var(--vp-c-brand-2);
  /* Non-color affordance: bold and underline so the active state survives
     forced-colors mode and meets WCAG 1.4.1 (Use of Color). */
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
  border-color: currentColor;
}
.filter-item:active,
.filter-item.active:active {
  color: var(--vp-c-brand-1, var(--vp-c-brand, #818cf8));
}
</style>
