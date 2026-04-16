# YusraPOS APK Build Instructions

This app is configured with **Capacitor** and is ready to be built as a native Android APK using Android Studio.

## Prerequisites
1. **Android Studio** installed on your machine.
2. **Node.js** and **npm** installed.

## Build Steps

### 1. Prepare the Web Assets
First, build the React application and sync it with the Android project:
```bash
npm run android:build
```
This command will:
- Run `npm run build` to generate the `dist` folder.
- Run `npx cap copy android` to copy the web assets into the Android project.
- Run `npx cap sync android` to update plugins and dependencies.

### 2. Open in Android Studio
Open the `android` folder in Android Studio:
```bash
npm run cap:open:android
```
Alternatively, open Android Studio and select **"Open an Existing Project"**, then navigate to the `android` directory in this project.

### 3. Generate APK
In Android Studio:
1. Wait for Gradle to finish syncing.
2. Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
3. Once finished, a notification will appear with a link to the generated APK file.

## Important Notes
- **Permissions**: The app is pre-configured with `CAMERA`, `RECORD_AUDIO`, and Storage permissions in `AndroidManifest.xml`.
- **Hardware Camera**: The `MainActivity.java` has been customized to handle WebView camera permissions automatically.
- **Offline First**: The app uses Dexie for local storage, making it perfect for areas with unstable internet.
- **Zakat History**: The app is designed to clear Zakat calculation history on every startup for privacy.
