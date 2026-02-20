import { createRouter, createWebHashHistory } from "vue-router";
import Stage from "../views/Stage.vue";
import Background from "../views/Background.vue";

const routes = [
  {
    path: "/",
    name: "Stage",
    component: Stage,
    // component: BackgroundHTML,
  },
  {
    path: "/background",
    name: "Background",
    component: Background,
  },
];

const router = createRouter({
  history: createWebHashHistory(),

  routes,
});

export default router;
