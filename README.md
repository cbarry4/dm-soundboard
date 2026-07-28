# DM Soundboard — Android APK Build Guide (Windows 11)

A standalone Android soundboard app. No internet needed. The DM loads their
own audio files from the tablet, which are stored permanently inside the app.

---

## What you need to install first (one-time setup)

### 1. Node.js
- Download from https://nodejs.org → click the **LTS** version
- Run the installer, leave all defaults checked (including "Add to PATH")
- Open a new Command Prompt and confirm: `node --version`

### 2. Android Studio
- Download from https://developer.android.com/studio
- Run the installer, leave all defaults
- On first launch it runs a setup wizard — let it download the Android SDK
  (this takes a few minutes and is ~1 GB)
- When the wizard finishes, note the SDK path shown in
  `Settings → Appearance & Behavior → System Settings → Android SDK`.
  It's usually: `C:\Users\YourName\AppData\Local\Android\Sdk`

### 3. Set the ANDROID_HOME environment variable
- Open Start → search "Environment Variables" → click "Edit the system environment variables"
- Click "Environment Variables…"
- Under "System variables" click New:
  - Variable name:  `ANDROID_HOME`
  - Variable value: `C:\Users\YourName\AppData\Local\Android\Sdk`
    (use your actual SDK path from step 2)
- Find the "Path" variable in System variables → Edit → New, and add:
  `C:\Users\YourName\AppData\Local\Android\Sdk\platform-tools`
- Click OK on all dialogs, then **close and reopen any Command Prompt windows**

Confirm it works: open a new Command Prompt and run `adb version`
— you should see something like `Android Debug Bridge version 1.0.41`

### 4. Java (JDK)
Android Studio ships with a JDK. Tell Capacitor where to find it by also adding
to your Path (same steps as above):
`C:\Program Files\Android\Android Studio\jbr\bin`

Confirm: `java -version` in a new Command Prompt.

---

## Building the APK (do this once, then again whenever the app changes)

Open **Command Prompt** (not PowerShell) and navigate to the dm_soundboard folder:
```
cd path\to\dm_soundboard
```

### Step 1 — Install dependencies
```
npm install
```
This downloads Capacitor into a `node_modules` folder. Takes ~1 minute.

### Step 2 — Add Android platform (first time only)
```
npx cap add android
```
This creates an `android/` folder with a full Android project. Only run this once.

### Step 3 — Sync web files into Android project
```
npx cap sync
```
This copies the `www/` folder (your HTML/CSS/JS) into the Android project.
Run this again any time you edit the web files.

### Step 4 — Open in Android Studio
```
npx cap open android
```
Android Studio opens. Wait for it to finish indexing (the progress bar at the
bottom of the screen — usually 1–2 minutes).

### Step 5 — Build the APK
In Android Studio:
- Menu bar → **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
- Wait for the build (1–3 minutes)
- Click the **"locate"** link in the notification that appears, or find the file at:
  `android\app\build\outputs\apk\debug\app-debug.apk`

---

## Installing on the DM's tablet

1. Copy `app-debug.apk` to the tablet (email it, Google Drive, USB cable, etc.)
2. On the tablet, open the file. Android will say "Install from unknown sources"
   is blocked — tap Settings in that dialog and enable it for whatever app
   you used to open the APK (Files, Gmail, etc.)
3. Go back and tap Install.
4. The app icon "DM Soundboard" will appear on the home screen.

---

## How the DM uses it

- **Add a tab**: tap ＋ Tab, type a category name (e.g. "Combat", "Ambience")
- **Add sounds**: tap the tab, tap ＋ Add Sounds, pick audio files from the
  tablet's storage. Files are stored permanently inside the app — no need to
  re-add them.
- **Play**: tap a sound pad to play. Tap again to stop just that one.
- **Layer**: tap multiple pads to play them simultaneously.
- **Loop**: tap 🔁 on a playing pad to loop it (great for ambience).
- **Volume**: the slider on each pad controls that sound independently.
- **Stop All**: stops every sound at once.
- **Edit mode** (✏️ Edit button): lets you rename or delete individual sounds,
  rename tabs, or delete entire tabs.

All sounds are stored permanently — they survive closing the app and rebooting
the tablet.

---

## Supported audio formats

`.mp3  .wav  .ogg  .m4a  .flac  .aac`

---

## Updating the app after code changes

If you ever update the HTML/CSS/JS:
```
npx cap sync
```
Then rebuild in Android Studio (Step 4–5 above) and reinstall the APK.
