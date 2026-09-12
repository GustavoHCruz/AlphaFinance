import { NativeModule, requireNativeModule } from "expo";
import type { NativeNotificationCandidate } from "./AlphaNative.types";

declare class AlphaNativeModule extends NativeModule<{}> {
  isNotificationAccessEnabled(): Promise<boolean>;
  openNotificationAccessSettings(): Promise<void>;
  getPendingNotificationEvents(): Promise<NativeNotificationCandidate[]>;
  acknowledgeNotificationEvents(sourceEventIds: string[]): Promise<void>;
  encryptBackup(plaintext: string, passphrase: string): Promise<string>;
  decryptBackup(envelope: string, passphrase: string): Promise<string>;
}

export default requireNativeModule<AlphaNativeModule>("AlphaNative");
