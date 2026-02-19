const pendingCallbacks = new Map();

const generateId = () =>
  `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

window.addEventListener("message", (event) => {
  console.log("Received from parent:", event.data);
  const data = event.data;

  // 处理调用响应
  if (data && data.id) {
    const callback = pendingCallbacks.get(data.id);

    if (callback) {
      if (data.code === 200) {
        callback.resolve(data);
      } else {
        callback.reject(new Error(data.msg));
      }
      pendingCallbacks.delete(data.id);
    }
    return;
  }
});

async function getSystemInfo() {
  return new Promise((resolve, reject) => {
    const id = generateId();
    pendingCallbacks.set(id, { resolve, reject });
    parent.postMessage({ id, method: "get_system_stats" }, "*");
    setTimeout(() => {
      if (pendingCallbacks.has(id)) {
        pendingCallbacks.delete(id);
        reject(new Error("Request timeout"));
      }
    }, 10000);
  });
}
