<template>
  <div class="shader-wallpaper">
    <div class="view-wrapper">
      <transition name="fade-slide" mode="out-in">
        <div v-if="view === 'list'" key="list" class="wallpaper-list">
          <div v-if="loading" class="loading">加载中...</div>
          <div v-else class="grid">
            <div v-for="item in shaders" :key="item.name" class="shader-item">
              <div class="thumb" @click="openDetail(item)">
                <canvas
                  :id="`preview-${item.name}`"
                  class="canvas-preview"
                ></canvas>
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
              <el-input type="textarea" :rows="20" v-model="currentCode" />
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount } from "vue";
import { ElButton, ElDivider, ElInput, ElIcon } from "element-plus";
import { ArrowLeft } from "@element-plus/icons-vue";

import * as BABYLON from "@babylonjs/core";

const shaders = ref([]);
const loading = ref(true);
const view = ref("list"); // 'list' | 'detail'
const currentShader = ref(null);
const currentCode = ref("");

let engine = null;
let scene = null;
let camera = null;
let material = null;

const fetchList = async () => {
  try {
    const res = await fetch("/shaders/list.json");
    const data = await res.json();
    shaders.value = data;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
    // kick off small previews
    nextTick(() => {
      shaders.value.forEach((s) => mountPreviewCanvas(s));
    });
  }
};

const mountPreviewCanvas = async (item) => {
  const canvas = document.getElementById(`preview-${item.name}`);
  if (!canvas) return;
  // simple WebGL fragment shader preview using raw gl for thumbnails
  try {
    const gl = canvas.getContext("webgl");
    canvas.width = 300;
    canvas.height = 150;
    const frag = await fetch(item.path).then((r) => r.text());
    // create simple shader program that runs the fragment shader
    const vertSrc = `attribute vec2 position; void main(){ gl_Position = vec4(position,0.0,1.0); }`;
    const vert = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vert, vertSrc);
    gl.compileShader(vert);
    const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, frag);
    gl.compileShader(fragShader);
    const prog = gl.createProgram();
    gl.attachShader(prog, vert);
    gl.attachShader(prog, fragShader);
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const pos = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  } catch (e) {
    console.warn("preview failed", e);
  }
};

const openDetail = async (item) => {
  currentShader.value = item;
  // load code
  const code = await fetch(item.path).then((r) => r.text());
  currentCode.value = code;
  view.value = "detail";
  nextTick(() => initBabylon());
};

const initBabylon = () => {
  const canvas = document.getElementById("babylon-canvas");
  if (!canvas) return;
  engine = new BABYLON.Engine(canvas, true);
  scene = new BABYLON.Scene(engine);
  camera = new BABYLON.FreeCamera("cam", new BABYLON.Vector3(0, 0, -5), scene);
  camera.setTarget(BABYLON.Vector3.Zero());
  camera.attachControl(canvas, true);

  const plane = BABYLON.MeshBuilder.CreatePlane(
    "plane",
    { width: 4, height: 2.25 },
    scene,
  );

  // create custom shader material using Babylon's ShaderMaterial (official style)
  try {
    const shaderName = "customShader";

    // vertex shader (uses worldViewProjection as Babylon provides)
    BABYLON.Effect.ShadersStore[shaderName + "VertexShader"] = `
      precision highp float;
      // Attributes
      attribute vec3 position;
      attribute vec2 uv;
      // Varyings
      varying vec2 vUV;
      // Uniforms provided by Babylon
      uniform mat4 worldViewProjection;
      void main(void) {
        vUV = uv;
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;

    // fragment shader: use the loaded shader source if it looks like a fragment shader,
    // otherwise use a simple default shader following Babylon's shader conventions
    let fragSource =
      currentCode.value && currentCode.value.includes("gl_FragColor")
        ? currentCode.value
        : `
        precision highp float;
        varying vec2 vUV;
        uniform float iTime;
        uniform vec2 iResolution;
        void main(void) {
          vec2 uv = vUV;
          vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0.0,2.0,4.0));
          gl_FragColor = vec4(col, 1.0);
        }
      `;

    BABYLON.Effect.ShadersStore[shaderName + "FragmentShader"] = fragSource;

    // create ShaderMaterial using Babylon official-style options
    material = new BABYLON.ShaderMaterial(
      "mat",
      scene,
      {
        vertex: shaderName,
        fragment: shaderName,
      },
      {
        attributes: ["position", "uv"],
        uniforms: [
          "world",
          "worldView",
          "worldViewProjection",
          "iTime",
          "iResolution",
        ],
      },
    );

    plane.material = material;
  } catch (e) {
    console.error("init shader failed", e);
  }

  let start = Date.now();
  engine.runRenderLoop(() => {
    const now = (Date.now() - start) / 1000;
    if (material && material.setFloat) {
      try {
        material.setFloat("iTime", now);
      } catch (e) {}
    }
    if (material && material.setVector2) {
      try {
        material.setVector2(
          "iResolution",
          new BABYLON.Vector2(canvas.width, canvas.height),
        );
      } catch (e) {}
    }
    scene.render();
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

onMounted(() => {
  fetchList();
});

onBeforeUnmount(() => {
  try {
    engine && engine.dispose();
  } catch (e) {}
});

const goBack = () => {
  // dispose babylon and return to list view
  try {
    engine && engine.dispose();
  } catch (e) {}
  engine = null;
  scene = null;
  camera = null;
  material = null;
  view.value = "list";
};
</script>

<style lang="less">
.shader-wallpaper {
  position: relative;
  padding: 0; // keep overall layout tight so view-wrapper controls offset
  width: 100vw;

  .view-wrapper {
    position: absolute;
    top: 20px;
    left: 20px;
    right: 20px;
    /* ensure both list and detail occupy the same box */
    min-height: 400px;
    width: 100%;
  }

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
      canvas.canvas-preview {
        width: 100%;
        height: 100%;
        display: block;
      }
      .meta {
        padding: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
    }
  }

  .detail-page {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    .detail-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 6px 12px 6px;

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
      height: 100%;
      .left {
        flex: 1;
        .babylon-canvas {
          width: 100%;
          height: 100%;
        }
      }
      .right {
        width: 45%;
        padding-left: 16px;
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
