# Android APK / Trusted Web Activity

Target website:

```text
https://excecutive-engine.onrender.com/
```

Recommended package name:

```text
com.executiveengine.app
```

## What is already prepared

- `client/public/manifest.webmanifest` has app metadata, scope, theme color, and PNG icons.
- `client/public/icon-192.png` and `client/public/icon-512.png` are Android-friendly app icons.
- `client/public/sw.js` registers a lightweight service worker so the site behaves like a PWA.

## Local requirements

Install these before building the APK locally:

```sh
brew install --cask temurin
brew install --cask android-studio
npm install -g @bubblewrap/cli
```

Open Android Studio once and install the Android SDK when prompted. Then restart the terminal so Java and Android SDK paths are available.

## Create the TWA project

From a folder outside the web app repo, run:

```sh
bubblewrap init --manifest=https://excecutive-engine.onrender.com/manifest.webmanifest
```

Use these values when prompted:

```text
Application ID: com.executiveengine.app
Application name: Executive Engine
Launcher name: Executive Engine
Host: excecutive-engine.onrender.com
Start URL: /
Display mode: standalone
Orientation: portrait-primary
Theme color: #0A0E17
Background color: #F8F7F3
```

Then build:

```sh
bubblewrap build
```

The generated APK is usually under the TWA project directory as a signed release APK.

## Required Digital Asset Links

A Play Store TWA needs the website to prove it trusts the Android package. Bubblewrap will print a SHA-256 certificate fingerprint after key generation. Add this file to the website:

```text
client/public/.well-known/assetlinks.json
```

Template:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.executiveengine.app",
      "sha256_cert_fingerprints": ["PASTE_BUBBLEWRAP_SHA256_FINGERPRINT_HERE"]
    }
  }
]
```

Deploy after adding the fingerprint, then rebuild the APK. For Play Store release builds, use the Play App Signing fingerprint from Google Play Console if Play manages your signing key.
