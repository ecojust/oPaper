<template>
  <div class="template-choose-shader">
    <div class="template-header">
      <h3>从模板创建</h3>
    </div>

    <div class="template-content">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>加载模板中...</span>
      </div>

      <!-- 模板列表 -->
      <div v-else class="template-grid">
        <!-- 内置模板 -->
        <div
          v-for="(template, index) in builtinTemplates"
          :key="'builtin-' + index"
          class="template-item"
          :class="{
            selected:
              selectedTemplate && selectedTemplate.title === template.title,
          }"
          @click="selectTemplate(template)"
        >
          <div class="template-preview builtin-preview">
            <div class="preview-placeholder">
              <!-- <el-icon size="32"><Picture /></el-icon> -->
              <img :src="template.thumbnail" alt="" />
            </div>
          </div>
          <div class="template-info">
            <span class="template-name">{{ template.title }}</span>
            <el-tag size="small" type="info">内置</el-tag>
          </div>
        </div>
      </div>
    </div>

    <div class="template-footer">
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleOk" :disabled="!selectedTemplate">
        确定
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { ElButton, ElTag, ElIcon, ElMessage } from "element-plus";
import { Picture, Loading } from "@element-plus/icons-vue";
import { builtinShaderBackgrounds } from "./const";

const emit = defineEmits(["close", "ok"]);

// 状态
const loading = ref(true);
const builtinTemplates = ref([]);
const externalTemplates = ref([]);
const selectedTemplate = ref(null);

// 加载内置模板
const loadBuiltinTemplates = () => {
  builtinTemplates.value = builtinShaderBackgrounds.map((item) => ({
    title: item.title,
    code: item.code,
    thumbnail: item.thumbnail,
    isBuiltin: true,
  }));
};

// 处理图片加载失败
const handleImageError = (event) => {
  event.target.style.display = "none";
  event.target.nextElementSibling.style.display = "flex";
};

// 选择内置模板
const selectTemplate = (template) => {
  console.log("Selected template:", template);
  selectedTemplate.value = template;
};

// 关闭
const handleClose = () => {
  emit("close");
};

// 确定
const handleOk = () => {
  if (selectedTemplate.value) {
    emit("ok", selectedTemplate.value);
  }
};

// 初始化
onMounted(async () => {
  loadBuiltinTemplates();
  loading.value = false;
});
</script>

<style lang="less">
.template-choose-shader {
  display: flex;
  flex-direction: column;
  width: 700px;
  max-height: 80vh;
  background: #0f1724;
  border-radius: 8px;
  overflow: hidden;

  .template-header {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    h3 {
      margin: 0;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
    }
  }

  .template-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: rgba(255, 255, 255, 0.6);
      padding: 40px;

      .el-icon {
        font-size: 24px;
      }
    }

    .template-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .template-item {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 2px solid transparent;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        transform: translateY(-2px);
      }

      &.selected {
        border-color: #409eff;
        box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.4);
      }

      .template-preview {
        height: 120px;
        background: #1a1a2e;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;

        &.builtin-preview {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .preview-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .preview-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.3);
          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        }
      }

      .template-info {
        padding: 10px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;

        .template-name {
          color: #fff;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
        }

        .el-tag {
          flex-shrink: 0;
        }
      }
    }
  }

  .template-footer {
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: flex-end;
    gap: 12px;

    .el-button {
      min-width: 80px;
    }
  }
}

// 隐藏 element-plus dialog 的默认样式
.pure-dialog {
  .el-dialog {
    background: transparent !important;
    box-shadow: none !important;
    border: none !important;
  }

  .el-overlay {
    background: rgba(0, 0, 0, 0.7) !important;
  }
}
</style>
