import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "./reset.less";
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
// 导入 Monaco Editor workers 配置（解决生产环境代码高亮问题）
import "./monaco-workers";

const app = createApp(App);

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(ElementPlus);
app.use(router);
app.mount("#app");
