<template>
  <div class="html-wallpaper"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { invoke } from "@tauri-apps/api/core";

onMounted(() => {});
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
