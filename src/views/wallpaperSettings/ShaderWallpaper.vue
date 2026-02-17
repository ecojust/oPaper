<template>
  <div class="shader-wallpaper">
    <div class="view-wrapper">
      <transition name="fade-slide" mode="out-in">
        <div v-if="view === 'list'" key="list" class="wallpaper-list">
          <div v-if="loading" class="loading">加载中...</div>
          <div v-else class="grid">
            <div v-for="item in shaders" :key="item.name" class="shader-item">
              <div class="thumb" @click="setShaderBackground(item)">
                <img :src="item.cover || defaultCover" class="cover-image" />
              </div>
              <div class="meta">
                <h3>{{ item.title }}</h3>
                <div class="actions">
                  <el-button size="small" @click="openDetail(item)"
                    >编辑</el-button
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>

      <transition name="fade-slide" mode="out-in">
        <div v-if="view === 'detail'" key="detail" class="detail-page">
          <div class="detail-header">
            <el-button type="text" @click="goBack">
              <el-icon><ArrowLeft /></el-icon>
            </el-button>
            <span class="detail-title">{{
              currentShader?.title || "Shader 编辑"
            }}</span>
          </div>
          <div class="detail">
            <div class="left">
              <canvas id="babylon-canvas" class="babylon-canvas"></canvas>
            </div>
            <div class="right">
              <el-button @click="saveShader" type="primary">保存</el-button>
              <el-divider />
              <div ref="monacoContainer" class="monaco-editor" />
            </div>
          </div>
        </div>
      </transition>
      <!-- hidden singleton mount for Monaco editor (keeps editor DOM alive) -->
      <div ref="monacoRoot" style="display: none"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount } from "vue";
import { ElButton, ElDivider, ElInput, ElIcon } from "element-plus";
import { ArrowLeft } from "@element-plus/icons-vue";

import { initBabylon, MonacoShaderEditor, Shader } from "@/service/shader";

const shaders = ref([]);
const loading = ref(true);
const view = ref("list"); // 'list' | 'detail'
const currentShader = ref(null);
const monacoContainer = ref(null);
const currentCode = ref("");
const config = ref({});

let babylonHandle = null;
let monacoEditor = null;

const defaultCover =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="100%" height="100%" fill="%23111"/><text x="50%25" y="50%25" fill="%23fff" font-size="20" font-family="Arial" text-anchor="middle" alignment-baseline="middle">No cover</text></svg>';

const fetchList = async () => {
  try {
    const localShaders = Shader.getLocalShaderList(); // for debug
    // console.log("Local shaders:", localShaders);
    // const res = await fetch("/shaders/list.json");
    // const data = await res.json();
    shaders.value = localShaders;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
    // covers are static images; no thumbnail init required
  }
};

const openDetail = async (item) => {
  currentShader.value = item;
  // load code
  const code = await fetch(item.path).then((r) => r.text());
  currentCode.value = code;
  view.value = "detail";
  nextTick(() => {
    const canvas = document.getElementById("babylon-canvas");
    if (canvas) {
      try {
        babylonHandle = initBabylon(canvas, () => currentCode.value);
      } catch (e) {
        console.error("init babylon failed", e);
      }
    }
    // initialize or reuse a singleton Monaco editor (dynamically import)
    const container = monacoContainer.value;
    if (container) {
      monacoEditor = new MonacoShaderEditor(
        container,
        currentCode.value,
        (code) => {
          currentCode.value = code;
        },
      );
    }
  });
};

const saveShader = async () => {
  // for now, just download the shader code as a file
  const blob = new Blob([currentCode.value], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = currentShader.value.name || "shader.frag";
  a.click();
  URL.revokeObjectURL(url);
};

const setShaderBackground = (item) => {
  //
  const path = item.path;
  Shader.setShaderBackground(path, {
    // any additional config can go here
    mode: "shader",
  });
  console.log("Set shader background:", item);
};

const goBack = () => {
  try {
    babylonHandle && babylonHandle.dispose && babylonHandle.dispose();
  } catch (e) {}
  babylonHandle = null;

  try {
    monacoEditor && monacoEditor.dispose && monacoEditor.dispose();
  } catch (e) {}
  monacoEditor = null;

  view.value = "list";
};

// read config
const readConfig = async () => {
  try {
    config.value = await Shader.readConfig();
  } catch (e) {
    console.error("read_config:", e);
  }
};

onMounted(() => {
  fetchList();
  readConfig();
});

onBeforeUnmount(() => {
  try {
    babylonHandle && babylonHandle.dispose && babylonHandle.dispose();
  } catch (e) {}
});
</script>

<style lang="less">
.shader-wallpaper {
  position: relative;
  /* add padding inside the component and include it in sizing to avoid overflow */
  padding: 20px;
  box-sizing: border-box;
  width: 100%;
  /* ensure the component fits the viewport and doesn't cause page scroll */
  height: 100%;
  // flex: 1;
  overflow: hidden;
  // background: red;

  .view-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    margin: 20px;

    /* ensure both list and detail occupy the same box */
    /* remove fixed min-height so it fits inside viewport */
    width: auto;
    .wallpaper-list {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;

      margin: 0; /* align to left-top inside view-wrapper */
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 16px;
      }
      .shader-item {
        background: white;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        .thumb {
          height: 150px;
          background: #111;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cover-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .meta {
          padding: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          h3 {
            color: #111;
          }
        }
      }
    }

    .detail-page {
      position: absolute;
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      .detail-header {
        display: flex;
        align-items: center;
        gap: 10px;

        .el-button {
          padding: 0;
          width: 36px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition:
            background-color 160ms ease,
            transform 120ms ease;
          color: #0f1724;
        }
        .el-button:hover {
          background: rgba(15, 23, 36, 0.06);
          transform: translateY(-1px);
        }
        .el-icon {
          font-size: 18px;
          line-height: 1;
        }
        .detail-title {
          font-size: 16px;
          font-weight: 700;
          color: #0f1724;
          margin-left: 6px;
        }
      }
      .detail {
        display: flex;
        flex: 1;
        overflow: hidden;
        .left {
          flex: 1;
          .babylon-canvas {
            width: 100%;
            height: 100%;
          }
        }
        .right {
          width: 60%;
          padding-left: 16px;
          .monaco-editor {
            height: 100%;
            border: 1px solid #e6e6e6;
            overflow: auto;
          }
        }
      }
    }
  }
}
/* transition styles for list/detail switching */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    opacity 260ms ease,
    transform 260ms ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.995);
}
.fade-slide-enter-to,
.fade-slide-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>
