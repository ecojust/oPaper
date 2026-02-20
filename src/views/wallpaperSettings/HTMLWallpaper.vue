<template>
  <div class="html-wallpaper">
    <div class="view-wrapper">
      <transition name="fade-slide" mode="out-in">
        <div v-if="view === 'list'" key="list" class="wallpaper-list">
          <el-scrollbar>
            <div v-if="loading" class="loading">加载中...</div>
            <div v-else class="grid">
              <!-- 新增 HTML 按钮 -->
              <div class="html-item add-new" @click="createNewHTML">
                <div class="add-icon">
                  <el-icon size="48"><Plus /></el-icon>
                </div>
                <div class="meta">
                  <h3>新建 HTML</h3>
                </div>
              </div>
              <!-- 现有 HTML 列表 -->
              <div
                v-for="item in htmlWallpapers"
                :key="item.name"
                class="html-item"
              >
                <div class="thumb" @click="setHTMLBackground(item)">
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
                      @click="removeHTMLBackground(item)"
                      >移除</el-button
                    >
                    <el-button size="small" @click="openDetail(item)"
                      >编辑</el-button
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
                currentHTML?.title || "HTML 编辑"
              }}</span>
            </div>

            <div class="button-bar">
              <el-button @click="previewHTML" :loading="previewing">
                预览
              </el-button>
              <el-button @click="saveHTML" type="primary">保存</el-button>
            </div>
          </div>
          <div class="detail">
            <div class="left">
              <div class="preview-container">
                {{ previewUrl }}
                <iframe
                  v-if="previewUrl"
                  ref="iframeRef"
                  :src="previewUrl"
                  class="html-preview"
                  sandbox="allow-scripts allow-same-origin"
                ></iframe>
                <div v-else class="preview-placeholder">
                  <p>点击"预览"查看效果</p>
                </div>
              </div>
            </div>
            <div class="right">
              <div ref="monacoContainer" class="editor-container"></div>
            </div>
          </div>
        </div>
      </transition>
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

import { ElMessageBox } from "element-plus";
import { sleep } from "@/utils/util";
import html2canvas from "html2canvas";

import { HTML, CodemirrorShaderEditor } from "@/service/html";

const htmlWallpapers = ref([]);
const loading = ref(true);
const view = ref("list"); // 'list' | 'detail'
const currentHTML = ref(null);
const monacoContainer = ref(null);
const currentCode = ref("");
const previewUrl = ref("");
const previewing = ref(false);
let monacoEditor = null;

const defaultCover =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="100%" height="100%" fill="%23111"/><text x="50%" y="50%" fill="%23fff" font-size="20" font-family="Arial" text-anchor="middle" alignment-baseline="middle">No cover</text></svg>';

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
      case "open_executable":
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

// 获取本地 HTML 壁纸列表
const fetchList = async () => {
  htmlWallpapers.value = await HTML.getLocalHTMLList();
  loading.value = false;
};

// 打开详情页
const openDetail = async (item) => {
  currentHTML.value = item;
  currentHTML.value.code = await HTML.getHTMLContent(item.url);
  view.value = "detail";
  nextTick(() => {
    initEditor();
  });
};

// 创建新的 HTML
const createNewHTML = async () => {
  currentHTML.value = await HTML.newDraft();
  view.value = "detail";
  nextTick(() => {
    sleep(100).then(() => {
      initEditor();
    });
  });
};

// 初始化编辑器 (简单 textarea)
const initEditor = async () => {
  // initialize CodeMirror editor
  const container = monacoContainer.value;
  if (container) {
    container.innerHTML = "";
    monacoEditor = new CodemirrorShaderEditor(
      container,
      currentHTML.value.code,
      (code) => {
        currentHTML.value.code = code;
      },
    );

    await previewHTML();
  }
};

// 预览 HTML
const previewHTML = async () => {
  previewing.value = true;
  try {
    // 将当前代码保存到临时 Blob URL 进行预览
    const blob = new Blob([currentHTML.value.code], { type: "text/html" });
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value);
    }
    previewUrl.value = URL.createObjectURL(blob);
  } catch (e) {
    console.error("Preview failed:", e);
  } finally {
    previewing.value = false;
  }
};

// 保存 HTML
const saveHTML = async () => {
  try {
    // 生成缩略图
    let thumbnailBase64 = "";
    if (iframeRef.value) {
      try {
        // 尝试捕获 iframe 内容
        const iframeDoc =
          iframeRef.value.contentDocument ||
          iframeRef.value.contentWindow.document;
        if (iframeDoc && iframeDoc.body) {
          const canvas = await html2canvas(iframeDoc.body, {
            backgroundColor: "#1a1a2e",
            scale: 0.5, // 缩小比例，减少图片大小
          });
          thumbnailBase64 = canvas.toDataURL("image/png");
        }
      } catch (e) {
        console.warn("Failed to generate thumbnail:", e);
      }
    }

    await HTML.saveHTMLBackground(
      currentHTML.value.title,
      currentHTML.value.code,
      thumbnailBase64,
    );

    goBack();
  } catch (e) {
    console.error("Failed to save HTML:", e);
    ElMessageBox.alert("保存失败：" + e, "错误", {
      confirmButtonText: "确定",
      type: "error",
    });
  }
};

// 生成缩略图
const generateThumbnail = async (folderPath) => {
  // 这里可以添加缩略图生成逻辑
  // 目前使用默认封面
};

// 移除 HTML 壁纸
const removeHTMLBackground = async (item) => {
  ElMessageBox.confirm(
    `确定要移除 "${item.title}" 这个 HTML 壁纸吗？`,
    "确认移除",
    {
      confirmButtonText: "确认",
      cancelButtonText: "取消",
      type: "warning",
    },
  )
    .then(async () => {
      try {
        await HTML.removeHTMLBackground(item.title);
        // 刷新列表
        fetchList();
      } catch (e) {
        console.error("Failed to remove HTML background:", e);
      }
    })
    .catch(() => {
      // 用户取消了操作
    });
};

// 设置为桌面壁纸
const setHTMLBackground = async (item) => {
  await HTML.setHTMLBackground(item.url);
};

const goBack = () => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = "";
  }
  view.value = "list";
  fetchList();
};

onMounted(() => {
  fetchList();
  window.addEventListener("message", handleMessage);
});

onActivated(() => {
  fetchList();
});

onBeforeUnmount(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
  window.removeEventListener("message", handleMessage);
});
</script>

<style lang="less">
.html-wallpaper {
  position: relative;
  // padding: 20px;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  overflow: hidden;

  .view-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    // margin: 20px;
    width: auto;

    .wallpaper-list {
      position: absolute;
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      margin: 0;

      .grid {
        padding: 20px;

        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 16px;
      }
      .html-item {
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
          img {
            height: 100%;
            object-fit: contain;
            // width: 100%;
          }
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
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-radius: 16px;
      box-shadow:
        0 4px 6px -1px rgba(0, 0, 0, 0.1),
        0 2px 4px -2px rgba(0, 0, 0, 0.1),
        0 0 0 1px rgba(255, 255, 255, 0.5) inset;
      overflow: hidden;

      .detail-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 16px;
        background: white;
        border-bottom: 1px solid #e2e8f0;

        .left {
          display: flex;
          align-items: center;
          gap: 8px;

          .el-button {
            padding: 0;
            width: 32px;
            height: 32px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
            color: #475569;
            background: transparent;
            border: none;
          }
          .el-button:hover {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
          }
          .el-icon {
            font-size: 16px;
            line-height: 1;
          }
          .detail-title {
            font-size: 14px;
            font-weight: 600;
            color: #1e293b;
          }
        }

        .button-bar {
          display: flex;
          gap: 8px;

          .el-button {
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
          }

          .el-button:first-child {
            background: white;
            border: 1px solid #e2e8f0;
            color: #475569;

            &:hover {
              background: #f8fafc;
              border-color: #cbd5e1;
              color: #1e293b;
            }
          }

          .el-button:last-child {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            color: white;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);

            &:hover {
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
          }
        }
      }

      .detail {
        display: flex;
        flex: 1;
        overflow: hidden;
        padding: 16px;
        gap: 16px;

        .left {
          flex: 1;
          background: #0f172a;
          border-radius: 12px;
          overflow: hidden;
          box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.3),
            0 2px 4px -2px rgba(0, 0, 0, 0.2),
            inset 0 0 0 1px rgba(255, 255, 255, 0.05);
          position: relative;

          &::before {
            content: "Preview";
            position: absolute;
            top: 12px;
            left: 12px;
            font-size: 11px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.4);
            text-transform: uppercase;
            letter-spacing: 0.1em;
            z-index: 10;
            pointer-events: none;
          }

          .preview-container {
            width: 100%;
            height: 100%;

            .html-preview {
              width: 100%;
              height: 100%;
              border: none;
              background: white;
            }

            .preview-placeholder {
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: rgba(255, 255, 255, 0.4);
              font-size: 14px;
            }
          }
        }
        .right {
          width: 55%;
          display: flex;
          flex-direction: column;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -2px rgba(0, 0, 0, 0.1);

          &::before {
            content: "HTML Code";
            display: block;
            padding: 12px 16px;
            font-size: 11px;
            font-weight: 600;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
          }

          .editor-container {
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;

            .code-editor {
              width: 100%;
              flex: 1;
              border: none;
              resize: none;
              padding: 16px;
              font-family: "Fira Code", "Consolas", monospace;
              font-size: 13px;
              line-height: 1.5;
              outline: none;
              background: #1e1e1e;
              color: #d4d4d4;
            }
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
