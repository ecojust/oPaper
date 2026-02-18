<template>
  <div class="background" ref="parent">
    <div class="log">
      <div class="item" v-for="i in msg" :key="i">
        {{ i }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import Config from "@/service/config";
import { initBabylon, Shader } from "@/service/shader";

import { oPaper } from "../utils/oPaper";

const parent = ref();
const msg = ref([]);

let instance = null;

const initBackground = async () => {
  msg.value.push("initBackground");
  if (!parent.value) {
    return;
  }
  const config = await Config.readConfig();
  msg.value.push("readConfig");

  switch (config.mode) {
    case "shader":
      msg.value.push("shader");

      msg.value.push(config.shaderPath);

      // const code = await fetch(config.shaderPath).then((r) => r.text());
      const code = await Shader.getGlslContent(config.shaderPath);

      msg.value.push("code");

      const canvas = document.createElement("canvas");
      canvas.id = "babylon-canvas";
      canvas.className = "babylon-canvas";
      canvas.style.cssText = "width:100%;height:100%;display:block;";
      parent.value.appendChild(canvas);

      msg.value.push("initBabylon");

      instance = initBabylon(canvas, () => {
        return code;
      });
      break;
    default:
      console.warn("Unknown background type:", type);
  }
};

onMounted(() => {
  msg.value.push("onMounted");

  try {
    initBackground();
  } catch (error) {
    console.error("Failed to initialize background:", error);
  }
});
</script>

<style lang="less">
/* 无需样式，全部由 oPaper 动态生成 */
.background {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  /* border:1px solid red; */
  background: black;
  .log {
    display: none;
  }
}
</style>
