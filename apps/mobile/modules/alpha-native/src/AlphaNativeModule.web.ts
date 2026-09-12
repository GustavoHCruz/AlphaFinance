import { registerWebModule, NativeModule } from "expo";

class AlphaNativeModule extends NativeModule<{}> {
  async isNotificationAccessEnabled() { return false; }
  async openNotificationAccessSettings() { throw new Error("Disponível somente no Android."); }
  async getPendingNotificationEvents() { return []; }
  async acknowledgeNotificationEvents() { }
  async encryptBackup() { throw new Error("Criptografia nativa indisponível nesta plataforma."); }
  async decryptBackup() { throw new Error("Criptografia nativa indisponível nesta plataforma."); }
}

export default registerWebModule(AlphaNativeModule, "AlphaNative");
