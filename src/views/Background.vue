<template>
  <div class="background" ref="parent"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { initBabylon } from "@/service/shader";
import { oPaper } from "../utils/oPaper";
import router from "@/router";

const parent = ref();
let instance = null;

const initBackground = () => {
  if (!parent.value) {
    return;
  }
  const type = router.currentRoute.value.query.wall_type || "shader";
  console.log(type);

  switch (type) {
    case "shader":
      const canvas = document.createElement("canvas");
      canvas.id = "babylon-canvas";
      canvas.className = "babylon-canvas";
      canvas.style.cssText = "width:100%;height:100%;display:block;";
      parent.value.appendChild(canvas);

      instance = initBabylon(canvas, () => {
        return `
        
        
        precision mediump float;
uniform float iTime;
uniform vec2 iResolution;

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  float t = iTime * 0.5;
  float color = 0.0;
  color += sin(uv.x * 10.0 + t);
  color += sin((uv.y + uv.x) * 10.0 + t * 1.3);
  color += sin(length(uv - 0.5) * 40.0 - t * 0.5);
  color = color / 3.0;
  gl_FragColor = vec4(vec3(0.5 + 0.5 * sin(color * 3.1415 + vec3(0.0, 2.0, 4.0))), 1.0);
}

        
        `;
      });
      break;
    default:
      console.warn("Unknown background type:", type);
  }
};

onMounted(() => {
  initBackground();
});

onUnmounted(() => {
  // if (instance) {
  //   instance.destroy();
  // }
});
</script>

<style scoped>
/* 无需样式，全部由 oPaper 动态生成 */
.background {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  /* border:1px solid red; */
  background: black;
}
</style>
