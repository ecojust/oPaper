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
import { invoke, convertFileSrc } from "@tauri-apps/api/core";

import { oPaper } from "../utils/oPaper";

const parent = ref();
const msg = ref([]);
let instance = null;
let iframe = null;

// 向 iframe 发送消息
const sendToIframe = (data) => {
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage(data, "*");
  }
};

// 处理来自 iframe 的调用请求
const handleInvoke = async (id, method, payload) => {
  msg.value.push("invoke", method);

  try {
    switch (method) {
      case "get_system_stats":
      case "open_executable":
        msg.value.push("invoke", payload);

        const result = await invoke(method, payload || {});

        msg.value.push("handleInvoke", result);

        // 返回结果给 iframe
        sendToIframe({
          id,
          code: 200,
          data: result,
          msg: "get return from shell",
        });
        break;

      default:
        console.log(`${method}: invalid method request!`);
        sendToIframe({
          id,
          code: 404,
          data: null,
          msg: "invalid method request!",
        });
        break;
    }
  } catch (error) {
    console.log(`${method}: something error in shell`);
    sendToIframe({
      id,
      code: 500,
      data: null,
      msg: "something error in shell",
    });
  }
};

// 监听来自 iframe 的消息
const handleMessage = async (event) => {
  // 验证消息来源
  if (
    !iframe ||
    !iframe.contentWindow ||
    event.source !== iframe.contentWindow
  ) {
    return;
  }
  const data = event.data;

  msg.value.push(data.method);

  // 处理调用请求
  if (data && data.id && data.method) {
    await handleInvoke(data.id, data.method, data.payload);
    return;
  }
};

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

    case "html":
      window.addEventListener("message", handleMessage);

      iframe = document.createElement("iframe");
      iframe.src = convertFileSrc(config.htmlPath);
      iframe.border = "none";
      iframe.style.cssText =
        "width:100%;height:100%;display:block;border-width:0px;";

      parent.value.appendChild(iframe);
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

onUnmounted(() => {
  iframe && window.removeEventListener("message", handleMessage);
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
