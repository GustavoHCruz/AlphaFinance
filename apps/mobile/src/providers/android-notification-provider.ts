import { Platform } from "react-native";
import AlphaNative from "../../modules/alpha-native";
import type { NotificationListenerStatus } from "../../modules/alpha-native";
import type { NativeNotificationCandidate } from "../domain/models";
import type { FinancialEventProvider, FinanceRepository } from "../domain/repositories";

export class AndroidNotificationProvider implements FinancialEventProvider {
  readonly id = "ANDROID_NOTIFICATION";

  async isEnabled(): Promise<boolean> {
    return Platform.OS === "android" && AlphaNative.isNotificationAccessEnabled();
  }

  async openSettings(): Promise<void> {
    if (Platform.OS !== "android") throw new Error("Disponível somente no Android.");
    await AlphaNative.openNotificationAccessSettings();
  }

  async collect(): Promise<NativeNotificationCandidate[]> {
    if (Platform.OS !== "android") return [];
    if (!await AlphaNative.isNotificationAccessEnabled()) return [];
    await AlphaNative.scanActiveNotifications();
    return AlphaNative.getPendingNotificationEvents();
  }

  async status(): Promise<NotificationListenerStatus | null> {
    if (Platform.OS !== "android") return null;
    try {
      return await AlphaNative.getNotificationListenerStatus();
    } catch {
      return null;
    }
  }

  async ingest(repository: FinanceRepository): Promise<number> {
    const candidates = await this.collect();
    const completed: string[] = [];
    for (const candidate of candidates) {
      await repository.enqueueNotification(candidate);
      completed.push(candidate.sourceEventId);
    }
    if (completed.length) await AlphaNative.acknowledgeNotificationEvents(completed);
    return completed.length;
  }
}
