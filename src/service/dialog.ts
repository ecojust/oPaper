import { ElMessageBox } from "element-plus";
import "element-plus/dist/index.css";
import { h } from "vue";
import TemplateChooseShader from "./TemplateChooseShader.vue";

export default class Dialog {
  static chooseShaderTemplate() {
    return new Promise((resolve, reject) => {
      ElMessageBox.confirm(
        h(TemplateChooseShader, {
          onOk: (template: any) => {
            ElMessageBox.close();
            resolve(template);
          },
          onClose: () => {
            ElMessageBox.close();
            reject();
          },
        }),
        "选择 Shader 模板",
        {
          closeOnClickModal: false,
          modalClass: "pure-dialog",
          showCancelButton: false,
          showConfirmButton: false,
        },
      )
        .then(() => {
          //
        })
        .catch(() => {
          //
        });
    });
  }
}
