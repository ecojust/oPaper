<template>
  <div class="stage">
    <div class="stage-header">
      <el-tabs v-model="activeTab" class="stage-tabs">
        <el-tab-pane label="静态壁纸" name="static" />
        <el-tab-pane label="Shader壁纸" name="shader" />
        <!-- <el-tab-pane label="三维壁纸" name="3d" /> -->
        <!-- <el-tab-pane label="在线壁纸" name="online" /> -->
      </el-tabs>
    </div>
    <div class="stage-content">
      <keep-alive>
        <component :is="activeComponent" />
      </keep-alive>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import StaticWallpaper from "./wallpaperSettings/StaticWallpaper.vue";
import ShaderWallpaper from "./wallpaperSettings/ShaderWallpaper.vue";
import ThreeDWallpaper from "./wallpaperSettings/ThreeDWallpaper.vue";
import OnlineWallpaper from "./wallpaperSettings/OnlineWallpaper.vue";

const activeTab = ref("static");

const components = {
  static: StaticWallpaper,
  shader: ShaderWallpaper,
  "3d": ThreeDWallpaper,
  online: OnlineWallpaper,
};

const activeComponent = computed(() => components[activeTab.value] || null);
</script>

<style lang="less" scoped>
.stage {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  background: #f5f5f5;
  padding: 20px;
  box-sizing: border-box;

  .stage-header {
    flex-shrink: 0;
    background: white;
    border-radius: 8px 8px 0 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

    :deep(.stage-tabs) {
      .el-tabs__header {
        margin: 0;
      }

      .el-tabs__nav-wrap::after {
        height: 1px;
      }

      .el-tabs__item {
        font-size: 16px;
        padding: 0 20px;
        height: 50px;
        line-height: 50px;

        &.is-active {
          color: #007bff;
          font-weight: 600;
        }
      }

      .el-tabs__active-bar {
        background-color: #007bff;
      }
    }
  }

  .stage-content {
    flex: 1;
    overflow-y: auto;
    background: white;
    border-radius: 0 0 8px 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}
</style>
