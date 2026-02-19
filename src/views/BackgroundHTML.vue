<template>
  <div class="html-wallpaper">
    <iframe
      ref="iframeRef"
      src="/wallpaper.html"
      frameborder="0"
      @load="handleIframeLoad"
    ></iframe>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { invoke } from "@tauri-apps/api/core";

const iframeRef = ref(null);

// 向 iframe 发送消息
const sendToIframe = (data) => {
  if (iframeRef.value?.contentWindow) {
    iframeRef.value.contentWindow.postMessage(data, "*");
  }
};

// 处理来自 iframe 的调用请求
const handleInvoke = async (id, method, payload) => {
  try {
    switch (method) {
      case "get_system_stats":
        const result = await invoke(method, payload || {});
        // 返回结果给 iframe
        sendToIframe({
          id,
          code: 200,
          data: result,
          msg: "get return from shell",
        });
        break;

      default:
        sendToIframe({
          id,
          code: 404,
          data: null,
          msg: "invalid method request!",
        });
        break;
    }
  } catch (error) {
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
    !iframeRef.value?.contentWindow ||
    event.source !== iframeRef.value.contentWindow
  ) {
    return;
  }

  const data = event.data;

  // 处理调用请求
  if (data && data.id && data.method) {
    await handleInvoke(data.id, data.method, data.payload);
    return;
  }
};

onMounted(() => {
  window.addEventListener("message", handleMessage);
});

onUnmounted(() => {
  window.removeEventListener("message", handleMessage);
});
</script>

<style lang="less" scoped>
.html-wallpaper {
  width: 100%;
  height: 100%;

  iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
}
</style>
