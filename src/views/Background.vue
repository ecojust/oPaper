<template>
  <div class="bbb" ref="parent"></div>
</template>

<script setup >
import { ref, onMounted, onUnmounted } from "vue";
import { oPaper } from "../utils/oPaper";

const parent = ref();
let instance = null;

onMounted(() => {
  if (parent.value) {
    const root = parent.value
    instance = oPaper.start(root);
  }
});

onUnmounted(() => {
  if (instance) {
    instance.destroy();
  }
});
</script>

<style scoped>
/* 无需样式，全部由 oPaper 动态生成 */
.bbb {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  /* border:1px solid red; */
}
</style>
