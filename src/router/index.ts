import { createRouter, createWebHashHistory } from "vue-router";
// import Stage from "../views/Stage.vue";
// import Background from "../views/Background.vue";

const routes = [
  {
    path: "/",
    name: "Stage",
    // component: Stage,
    component: import("../views/Stage.vue"),

    // component: BackgroundHTML,
  },
  {
    path: "/background",
    name: "Background",
    // component: Background,
    component: import("../views/Background.vue"),
  },
];

const router = createRouter({
  history: createWebHashHistory(),

  routes,
});

export default router;
