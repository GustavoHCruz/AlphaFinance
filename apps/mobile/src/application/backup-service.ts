import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import AlphaNative from "../../modules/alpha-native";
import type { FinanceRepository } from "../domain/repositories";
import { validateSnapshot } from "./snapshot-validation";

const BACKUP_MIME = "application/vnd.alphafinance.backup";

function fileStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function encryptedSnapshot(repository: FinanceRepository, passphrase: string) {
  const snapshot = await repository.exportSnapshot();
  return AlphaNative.encryptBackup(JSON.stringify(snapshot), passphrase);
}

export class BackupService {
  constructor(private readonly repository: FinanceRepository) {}

  async create(passphrase: string): Promise<string> {
    if (passphrase.length < 10) throw new Error("Use uma senha de backup com pelo menos 10 caracteres.");
    const envelope = await encryptedSnapshot(this.repository, passphrase);
    const directory = await Directory.pickDirectoryAsync();
    const file = directory.createFile(`AlphaFinance-${fileStamp()}.afbackup`, BACKUP_MIME);
    file.write(envelope);
    return file.uri;
  }

  async restore(passphrase: string): Promise<void> {
    const result = await DocumentPicker.getDocumentAsync({
      type: [BACKUP_MIME, "application/json", "application/octet-stream"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const selected = new File(result.assets[0].uri);
    if (selected.size > 75_000_000) throw new Error("O arquivo de backup é grande demais.");
    const plaintext = await AlphaNative.decryptBackup(await selected.text(), passphrase);
    const snapshot = validateSnapshot(JSON.parse(plaintext));

    // A restauração é transacional; esta cópia privada adiciona uma segunda rota de recuperação.
    const recoveryDirectory = new Directory(Paths.document, "recovery");
    recoveryDirectory.create({ idempotent: true, intermediates: true });
    const recovery = new File(recoveryDirectory, `pre-restore-${fileStamp()}.afbackup`);
    recovery.create({ overwrite: false, intermediates: true });
    recovery.write(await encryptedSnapshot(this.repository, passphrase));
    await this.repository.importSnapshot(snapshot);
  }

  async importLegacySnapshot(): Promise<void> {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true, multiple: false });
    if (result.canceled) return;
    const file = new File(result.assets[0].uri);
    if (file.size > 75_000_000) throw new Error("O arquivo de migração é grande demais.");
    await this.repository.importSnapshot(validateSnapshot(JSON.parse(await file.text())));
  }
}
