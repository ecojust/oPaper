<template>
  <div class="static-wallpaper">
    <div class="wallpaper-settings">
      <div class="setting-item">
        <span class="setting-label">开启循环</span>
        <el-switch v-model="loopEnabled" @change="handleLoopChange" />
      </div>
      <div v-if="loopEnabled" class="setting-item">
        <span class="setting-label">循环来源</span>
        <el-radio-group v-model="loopMode" @change="handleLoopModeChange">
          <el-radio value="local">本地</el-radio>
          <el-radio value="cloud">云端</el-radio>
        </el-radio-group>
      </div>
    </div>

    <!-- 云端循环模式：只显示一张temp图片和按钮 -->
    <div v-if="loopEnabled && loopMode === 'cloud'" class="cloud-wallpaper">
      <div class="cloud-card">
        <div class="cloud-preview">
          <img v-if="temp" :src="temp.imageUrl" alt="云端当前壁纸" />
          <div v-else class="cloud-placeholder">
            <p>点击"下一张"获取云端壁纸</p>
          </div>
        </div>
        <div class="cloud-actions">
          <el-button
            type="primary"
            @click="handleDownloadCurrent"
            :loading="downloading"
            :disabled="!temp"
          >
            下载到本地
          </el-button>
          <el-button
            type="success"
            @click="fetchRandomImage"
            :loading="isFecthingRandom"
          >
            下一张
          </el-button>
        </div>
      </div>
    </div>

    <!-- 本地壁纸列表 -->
    <div v-else class="wallpaper-list">
      <div v-if="loading" class="loading">加载中...</div>

      <div v-else-if="error" class="error">{{ error }}</div>

      <div v-else-if="wallpapers.length === 0" class="empty">
        <div class="empty-content">
          <p>暂无壁纸，请添加壁纸到资源文件夹</p>
          <el-button
            type="primary"
            size="large"
            @click="fetchFromCloud"
            :loading="fetchingFromCloud"
          >
            立即从云端获取壁纸
          </el-button>
        </div>
      </div>

      <div v-else class="grid">
        <div
          v-for="wallpaper in wallpapers"
          :key="wallpaper.id"
          class="wallpaper-item"
          :class="{ downloading: downloadingId === wallpaper.id }"
          @click="selectWallpaper(wallpaper)"
        >
          <img :src="wallpaper.thumbnail" :alt="wallpaper.title" />
          <div class="info">
            <h3>{{ wallpaper.title }}</h3>
            <p v-if="wallpaper.author">{{ wallpaper.author }}</p>
          </div>
          <div v-if="downloadingId === wallpaper.id" class="download-overlay">
            <div class="spinner"></div>
            <p>正在应用...</p>
          </div>
          <div
            class="delete-overlay"
            @click.stop="handleDeleteWallpaper(wallpaper)"
          >
            <el-button type="danger" size="small" circle>
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue";
import Panel from "@/service/panel";
import { IntervalCorn } from "@/service/corn";
import { ElMessage } from "element-plus";
import { Delete } from "@element-plus/icons-vue";

const wallpapers = ref([]);
const config = ref({});
const loading = ref(false);
const error = ref("");
const downloadingId = ref(null);
const loopEnabled = ref(false);
const loopMode = ref("local");
const downloading = ref(false);
const temp = ref({
  pathUrl: "",
  rawUrl: "",
  imageUrl: "",
});
const fetchingFromCloud = ref(false);

let corn = null;

const showDownloadBtn = computed(() => {
  return (
    loopEnabled.value &&
    loopMode.value === "cloud" &&
    temp.value.imageUrl !== ""
  );
});

// 列表显示的图片，包含本地壁纸和云端temp图片
const displayWallpapers = computed(() => {
  const list = [...wallpapers.value];
  // 当开启循环且是云端模式时，在列表顶部显示temp图片
  if (loopEnabled.value && loopMode.value === "cloud" && temp.value.imageUrl) {
    list.unshift({
      id: "temp-cloud",
      title: "云端当前壁纸",
      thumbnail: temp.value.imageUrl,
      url: temp.value.pathUrl,
      isTemp: true,
    });
  }
  return list;
});

// set local wallpaper
const selectWallpaper = async (wallpaper) => {
  if (downloadingId.value) return;
  downloadingId.value = wallpaper.id;
  await Panel.setWallpaperFromLocal(wallpaper.url, config.value);
  // readConfig();
  downloadingId.value = null;
};

// read local wallpapers
const readLocalStaticWallpapers = async () => {
  wallpapers.value = await Panel.readLocalStaticWallpapers();
};

// save config
const saveConfig = async (updates) => {
  try {
    await Panel.saveConfig(updates);
    config.value = { ...config.value, ...updates };
  } catch (e) {
    console.error("save_config:", e);
  }
};

// handle loop enabled/disabled
const handleLoopChange = async (value) => {
  corn && corn.stop();
  corn = null;
  await saveConfig({ loop: value });
  updateCorn();
};

// handle loop mode change
const handleLoopModeChange = async (value) => {
  console.log("Loop mode changed to:", value);
  corn && corn.stop();
  corn = null;
  await saveConfig({ loop_mode: value });
  updateCorn();
};

// handle download current wallpaper
const handleDownloadCurrent = async () => {
  downloading.value = true;
  const success = await Panel.downloadCurrentWallpaper(temp.value.pathUrl);

  downloading.value = false;

  if (success) {
    ElMessage.success("壁纸已保存到本地");
    // Refresh local wallpapers
    await readLocalStaticWallpapers();
  } else {
    ElMessage.error("下载失败，请重试");
  }
};

// update corn timer
const updateCorn = () => {
  if (loopEnabled.value && config.value.mode === "static") {
    corn = new IntervalCorn(() => {
      if (!loopEnabled.value || config.value.mode !== "static") {
        console.log("Loop不符合条件，即将关闭corn");
        corn && corn.stop();
        corn = null;
        return;
      }
      if (isFecthingRandom.value) {
        console.log("正在获取云端壁纸，跳过本次循环");
        return;
      }
      if (loopMode.value === "local") {
        const nextWallpaper =
          wallpapers.value[Math.floor(Math.random() * wallpapers.value.length)];
        if (nextWallpaper) {
          selectWallpaper(nextWallpaper);
        }
        console.log("触发loop，从本地切换壁纸:", nextWallpaper);
      } else {
        console.log("触发loop，从云端切换壁纸:");
        fetchRandomImage();
      }
    }, 30);
  }
};

// read config
const readConfig = async () => {
  try {
    corn && corn.stop();
    corn = null;

    config.value = await Panel.readConfig();
    loopEnabled.value = config.value.loop || false;
    loopMode.value = config.value.loop_mode || "local";
    // Show download button when loop mode is cloud
    updateCorn();
  } catch (e) {
    console.error("read_config:", e);
  }
};

const isFecthingRandom = ref(false);

// fetch cloud random wallpaper
const fetchRandomImage = async () => {
  isFecthingRandom.value = true;
  temp.value = await Panel.getRandomWallpaper(config.value);
  // After fetching from cloud, show download button
  // await readConfig();
  isFecthingRandom.value = false;
};

// fetch from cloud when no wallpapers available
const fetchFromCloud = async () => {
  fetchingFromCloud.value = true;
  try {
    await fetchRandomImage();
    await handleDownloadCurrent();
  } catch (e) {
    console.error("fetchFromCloud:", e);
    ElMessage.error("获取壁纸失败，请重试");
  } finally {
    fetchingFromCloud.value = false;
  }
};

// delete wallpaper
const handleDeleteWallpaper = async (wallpaper) => {
  try {
    const success = await Panel.deleteWallpaper(wallpaper.url);
    if (success) {
      ElMessage.success("壁纸已删除");
      // Refresh local wallpapers
      await readLocalStaticWallpapers();
    } else {
      ElMessage.error("删除失败，请重试");
    }
  } catch (e) {
    console.error("delete_wallpaper:", e);
    ElMessage.error("删除失败，请重试");
  }
};

onMounted(() => {
  readConfig();
  readLocalStaticWallpapers();
});

onUnmounted(() => {
  corn && corn.stop();
});
</script>

<style lang="less" scoped>
.static-wallpaper {
  .wallpaper-settings {
    display: flex;
    align-items: center;
    gap: 30px;
    padding: 15px 20px;
    background: #f8f9fa;
    border-bottom: 1px solid #e9ecef;
    flex-wrap: wrap;

    .setting-item {
      display: flex;
      align-items: center;
      gap: 10px;

      .setting-label {
        font-size: 14px;
        color: #333;
        font-weight: 500;
      }
    }
  }

  // 云端循环模式样式
  .cloud-wallpaper {
    display: flex;
    justify-content: center;
    padding: 40px 20px;

    .cloud-card {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      max-width: 500px;
      width: 100%;

      .cloud-preview {
        width: 100%;
        height: 300px;
        background: #f0f2f5;
        display: flex;
        align-items: center;
        justify-content: center;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .cloud-placeholder {
          text-align: center;
          color: #999;

          p {
            font-size: 16px;
          }
        }
      }

      .cloud-actions {
        padding: 20px;
        display: flex;
        gap: 15px;
        justify-content: center;
      }
    }
  }

  .wallpaper-list {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;

    .loading,
    .error,
    .empty {
      text-align: center;
      padding: 40px;
      font-size: 18px;
    }

    .error {
      color: #dc3545;
    }

    .empty {
      color: #666;

      .empty-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;

        p {
          margin: 0;
          font-size: 18px;
          color: #666;
        }
      }
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }

    .wallpaper-item {
      background: white;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition:
        transform 0.3s,
        box-shadow 0.3s;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      position: relative;
      border: 2px solid transparent;

      &:hover {
        transform: translateY(-5px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      }

      &.temp-item {
        border-color: #409eff;
      }

      &.downloading {
        pointer-events: none;
        opacity: 0.8;
      }

      img {
        width: 100%;
        height: 200px;
        object-fit: cover;
        display: block;
      }

      .info {
        padding: 15px;

        h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          color: #333;
          font-weight: 600;
        }

        p {
          margin: 0;
          font-size: 14px;
          color: #666;
        }
      }

      .download-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;

        p {
          margin-top: 10px;
          font-size: 14px;
        }
      }

      .delete-overlay {
        position: absolute;
        top: 10px;
        right: 10px;
        opacity: 0;
        transition: opacity 0.3s;

        &:hover {
          opacity: 1;
        }
      }

      &:hover .delete-overlay {
        opacity: 1;
      }
    }
  }
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
