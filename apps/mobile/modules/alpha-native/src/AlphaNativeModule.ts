import { NativeModule, requireNativeModule } from "expo";
import type { NativeNotificationCandidate, NotificationListenerStatus } from "./AlphaNative.types";

declare class AlphaNativeModule extends NativeModule<{}> {
  isNotificationAccessEnabled(): Promise<boolean>;
  openNotificationAccessSettings(): Promise<void>;
  getPendingNotificationEvents(): Promise<NativeNotificationCandidate[]>;
  getNotificationListenerStatus(): Promise<NotificationListenerStatus>;
  acknowledgeNotificationEvents(sourceEventIds: string[]): Promise<void>;
  encryptBackup(plaintext: string, passphrase: string): Promise<string>;
  decryptBackup(envelope: string, passphrase: string): Promise<string>;
}

export default requireNativeModule<AlphaNativeModule>("AlphaNative");
