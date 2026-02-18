<template>
  <div class="shader-wallpaper">
    <div class="view-wrapper">
      <transition name="fade-slide" mode="out-in">
        <div v-if="view === 'list'" key="list" class="wallpaper-list">
          <el-scrollbar>
            <div v-if="loading" class="loading">加载中...</div>
            <div v-else class="grid">
              <!-- 新增 Shader 按钮 -->
              <div class="shader-item add-new" @click="createNewShader">
                <div class="add-icon">
                  <el-icon size="48"><Plus /></el-icon>
                </div>
                <div class="meta">
                  <h3>新建着色器</h3>
                </div>
              </div>
              <!-- 现有 Shader 列表 -->
              <div v-for="item in shaders" :key="item.name" class="shader-item">
                <div class="thumb" @click="openDetail(item)">
                  <img
                    :src="item.thumbnail || defaultCover"
                    class="cover-image"
                  />
                </div>
                <div class="meta">
                  <h3>{{ item.title }}</h3>
                  <div class="actions">
                    <el-button
                      size="small"
                      type="danger"
                      @click="removeShaderBackground(item)"
                      >移除</el-button
                    >
                    <el-button size="small" @click="setShaderBackground(item)"
                      >应用</el-button
                    >
                  </div>
                </div>
              </div>
            </div>
          </el-scrollbar>
        </div>
      </transition>

      <transition name="fade-slide" mode="out-in">
        <div v-if="view === 'detail'" key="detail" class="detail-page">
          <div class="detail-header">
            <div class="left">
              <el-button type="text" @click="goBack">
                <el-icon><ArrowLeft /></el-icon>
              </el-button>
              <span class="detail-title">{{
                currentShader?.title || "Shader 编辑"
              }}</span>
            </div>

            <div class="button-bar">
              <el-button @click="recompileShader" :loading="recompiling">
                重新编译
              </el-button>
              <el-button @click="saveShader" type="primary">保存</el-button>
            </div>
          </div>
          <div class="detail">
            <div class="left">
              <canvas id="babylon-canvas" class="babylon-canvas"></canvas>
            </div>
            <div class="right">
              <!-- <el-divider /> -->
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
import { ref, onMounted, nextTick, onBeforeUnmount, onActivated } from "vue";
import {
  ElButton,
  ElDivider,
  ElInput,
  ElIcon,
  ElScrollbar,
} from "element-plus";
import { ArrowLeft, Plus } from "@element-plus/icons-vue";

import { initBabylon, MonacoShaderEditor, Shader } from "@/service/shader";
import { ElMessageBox } from "element-plus";
import { sleep } from "@/utils/util";

const shaders = ref([]);
const loading = ref(true);
const view = ref("list"); // 'list' | 'detail'
const currentShader = ref(null);
const monacoContainer = ref(null);
const currentCode = ref("");
const config = ref({});
const recompiling = ref(false);

let babylonHandle = null;
let monacoEditor = null;

const defaultCover =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="100%" height="100%" fill="%23111"/><text x="50%25" y="50%25" fill="%23fff" font-size="20" font-family="Arial" text-anchor="middle" alignment-baseline="middle">No cover</text></svg>';

const fetchList = async () => {
  try {
    const localShaders = await Shader.getLocalShaderList(); // for debug

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
  // const code = await fetch(item.url).then((r) => r.text());
  const code = await Shader.getGlslContent(item.url);
  console.log("Loaded shader code:", code);
  currentShader.value.code = code;
  view.value = "detail";
  nextTick(() => {
    initEditor();
  });
};

// 创建新的 Shader（从模板）
const createNewShader = async () => {
  try {
    const draft = await Shader.newDraft();
    currentShader.value = {
      title: draft.title,
      code: draft.code,
    };
    view.value = "detail";
    nextTick(() => {
      sleep(100).then(() => {
        initEditor();
      });
    });
  } catch (e) {
    console.error("Failed to create new shader:", e);
  }
};

// 初始化编辑器（Babylon + Monaco）
const initEditor = () => {
  const canvas = document.getElementById("babylon-canvas");
  if (canvas) {
    try {
      babylonHandle = initBabylon(canvas, () => currentShader.value.code);
    } catch (e) {
      console.error("init babylon failed", e);
    }
  }
  // initialize or reuse a singleton Monaco editor (dynamically import)
  const container = monacoContainer.value;
  if (container) {
    monacoEditor = new MonacoShaderEditor(
      container,
      currentShader.value.code,
      (code) => {
        currentShader.value.code = code;
      },
    );
  }
};

const recompileShader = async () => {
  if (!babylonHandle || !babylonHandle.updateCode) {
    console.warn("No babylon handle or updateCode function available");
    return;
  }
  recompiling.value = true;
  try {
    // Update the shader code in Babylon
    babylonHandle.updateCode(currentShader.value.code);
  } catch (e) {
    console.error("Failed to recompile shader:", e);
  } finally {
    recompiling.value = false;
  }
};

const saveShader = async () => {
  const base64Data = await babylonHandle.sceneShot();
  await Shader.saveShaderBackground(
    currentShader.value.title,
    currentShader.value.code,
    base64Data,
  );
  goBack();
};

const removeShaderBackground = async (item) => {
  ElMessageBox.confirm(
    `确定要移除 "${item.title}" 这个 Shader 吗？`,
    "确认移除",
    {
      confirmButtonText: "确认",
      cancelButtonText: "取消",
      type: "warning",
    },
  )
    .then(async () => {
      try {
        await Shader.removeShaderBackground(item.title);
        // 刷新列表
        fetchList();
      } catch (e) {
        console.error("Failed to remove shader background:", e);
      }
    })
    .catch(() => {
      // 用户取消了操作
    });
};

const setShaderBackground = (item) => {
  Shader.setShaderBackground(item.url);
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
  fetchList();
};

// read config
const readConfig = async () => {
  try {
    config.value = await Shader.readConfig();
    console.log("read_config:", config.value);
  } catch (e) {
    console.error("read_config:", e);
  }
};

onMounted(() => {
  fetchList();
  readConfig();
});

onActivated(() => {
  // 每次进入页面都刷新列表，确保数据是最新的
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
      right: 0;
      bottom: 0;
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
        cursor: pointer;
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease;
        &:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        }
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
        // 新建按钮样式
        &.add-new {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 200px;
          .add-icon {
            color: white;
            opacity: 0.9;
          }
          .meta {
            justify-content: center;
            h3 {
              color: white;
              font-weight: 500;
            }
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
        justify-content: space-between;
        gap: 10px;

        .left {
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

        .button-bar {
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
          display: flex;
          flex-direction: column;
          .button-bar {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
          }
          .monaco-editor {
            flex: 1;
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
