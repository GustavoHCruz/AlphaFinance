# AlphaFinance

A local-first mobile app for personal finance management. Version 1.0 works entirely offline on Android: each installation maintains its own data in SQLite and does not rely on an API, server, or online account.

## What's included

- Income, expenses, accounts, and investments.
- Editable recurring transactions.
- Categories and tags configurable by transaction type.
- Automatic carry-over of the previous month's balance.
- Monthly summary, six-month cash flow, and spending distribution by category.
- Inbox for reviewing financial signals before creating a transaction.
- Optional capture of Banco Inter notifications via the official Android feature.
- Encrypted backup and restore using the system file picker, supporting providers like Google Drive.

## Architecture

```text
React Native UI
↓
Financial domain in TypeScript
↓
Repository interfaces
↓
Local SQLite

providers → FinancialEvent → Inbox → review → transaction
SQLite → validated snapshot → AES-256-GCM → user-selected file
```

SQLite is the single source of truth. The domain logic is independent of React Native, Android, or SQLite. The database uses incremental migrations via `PRAGMA user_version`; monetary values ​​are stored in cents.

Backups use AES-256-GCM with a key derived via PBKDF2-HMAC-SHA-256. The file is validated before restoration, and the password is not stored by the app. ## Android Development

Validated environment: Node.js 24, JDK 17, Android SDK/Platform 36, and Android Build Tools 36.

```powershell
npm install
npm run mobile:typecheck
npm run mobile:test
npm run test:native:android --workspace apps/mobile
npm run mobile:android
```

To regenerate the Android project and create the release APK:

```powershell
npm run prebuild:android --workspace apps/mobile
npm run mobile:apk
```

The APK is generated at `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`. The distributable copy can be placed in `dist/`, which is not version-controlled; for a GitHub Release, manually attach the APK to the published version.

To use a physical device, enable developer options and USB debugging, connect the device, and verify it using `adb devices`. Then run:

```powershell
npm run android:device --workspace apps/mobile
```

## Signing Releases

Version 1.0 and future updates must be signed using the official key kept outside the repository at `%USERPROFILE%\Documents\AlphaFinance-signing`. The user environment variable `ALPHAFINANCE_SIGNING_PROPERTIES` points to the `signing.properties` file in that folder.

Keep a private backup of the entire folder. Never push the key or `signing.properties` to GitHub. Without them, Android will not accept a new version as an update to the installed app.

Before generating a new release:

1. Update `version` and increment `android.versionCode` in `apps/mobile/app.json`.
2. Run tests and `expo-doctor`, then generate the release APK.
3. Install the APK as an update on a device containing real test data.
4. Verify backup, restore, Inbox functionality, and offline startup. The APK's SHA-256 hash is optional and serves solely to verify that the distributed file has not been altered.

## Direction for future iterations

- Preserve migrations and backup compatibility when evolving the database.
- Keep the UI, domain, and repositories shareable with iOS.
- Treat the notification listener as an exclusive, optional Android capability.
- Add new parsers/providers—such as for CSV or other institutions—without coupling them to the Inbox.
- Continue without analytics, telemetry, mandatory backend services, or broad permissions.

Consult the [privacy policy](PRIVACY.md) before introducing dependencies or integrations.
