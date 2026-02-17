<template>
  <div class="online-wallpaper">
    <div class="content-area">
      <p>在线壁纸功能开发中...</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import Panel from "@/service/panel";

const config = ref({});
const temp = ref("");

// read config
const readConfig = async () => {
  try {
    config.value = await Panel.readConfig();
  } catch (e) {
    console.error("read_config:", e);
  }
};

// fetch cloud random wallpaper
const fetchRandomImage = async () => {
  await readConfig();
  const { pathUrl } = await Panel.getRandomWallpaper(config.value);
  temp.value = pathUrl;
};

readConfig();
</script>

<style lang="less" scoped>
.online-wallpaper {
  .content-area {
    text-align: center;
    padding: 60px 20px;

    p {
      font-size: 18px;
      color: #666;
    }
  }
}
</style>
