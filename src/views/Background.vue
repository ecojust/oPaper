<template>
  <div class="background" ref="parent"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import Config from "@/service/config";
import { initBabylon, Shader } from "@/service/shader";

import { oPaper } from "../utils/oPaper";

const parent = ref();
let instance = null;

const initBackground = async () => {
  if (!parent.value) {
    return;
  }
  const config = await Config.readConfig();

  switch (config.mode) {
    case "shader":
      const code = await fetch(config.shaderPath).then((r) => r.text());
      const canvas = document.createElement("canvas");
      canvas.id = "babylon-canvas";
      canvas.className = "babylon-canvas";
      canvas.style.cssText = "width:100%;height:100%;display:block;";
      parent.value.appendChild(canvas);

      instance = initBabylon(canvas, () => {
        return code;
      });
      break;
    default:
      console.warn("Unknown background type:", type);
  }
};

onMounted(() => {
  initBackground();
});
</script>

<style scoped>
/* 无需样式，全部由 oPaper 动态生成 */
.background {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  /* border:1px solid red; */
  background: black;
}
</style>
