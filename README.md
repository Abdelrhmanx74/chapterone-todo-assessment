# ChapterOne Todo Assessment
React Native todo app

## Stack
**React Native** + **Expo** — cross-platform (iOS, Android, Web)
**TypeScript** — type safety
**Nativewind** — Tailwind CSS for native
**React Native Reusables** — battle-tested UI primitives

## Features
Add/complete/delete todos
Persistent state via Context

## Run
```bash\npnpm dev\n```
Press `i` (iOS), `a` (Android), or `w` (Web).

<<<<<<< HEAD
## Getting Started

To run the development server:

```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    # or
    bun dev
```

This will start the Expo Dev Server. Open the app in:

- **iOS**: press `i` to launch in the iOS simulator _(Mac only)_
- **Android**: press `a` to launch in the Android emulator
- **Web**: press `w` to run in a browser

You can also scan the QR code using the [Expo Go](https://expo.dev/go) app on your device. This project fully supports running in Expo Go for quick testing on physical devices.

## Adding components

You can add more reusable components using the CLI:

```bash
npx react-native-reusables/cli@latest add [...components]
```

> e.g. `npx react-native-reusables/cli@latest add input textarea`

If you don't specify any component names, you'll be prompted to select which components to add interactively. Use the `--all` flag to install all available components at once.

## Project Features

- ⚛️ Built with [Expo Router](https://expo.dev/router)
- 🎨 Styled with [Tailwind CSS](https://tailwindcss.com/) via [Nativewind](https://www.nativewind.dev/)
- 📦 UI powered by [React Native Reusables](https://github.com/founded-labs/react-native-reusables)
- 🚀 New Architecture enabled
- 🔥 Edge to Edge enabled
- 📱 Runs on iOS, Android, and Web

## Learn More

To dive deeper into the technologies used:

- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Expo Docs](https://docs.expo.dev/)
- [Nativewind Docs](https://www.nativewind.dev/)
- [React Native Reusables](https://reactnativereusables.com)

## Deploy with EAS

The easiest way to deploy your app is with [Expo Application Services (EAS)](https://expo.dev/eas).

- [EAS Build](https://docs.expo.dev/build/introduction/)
- [EAS Updates](https://docs.expo.dev/eas-update/introduction/)
- [EAS Submit](https://docs.expo.dev/submit/introduction/)

## PC Local LLM Server (LAN)

This repo includes a small Node.js server that runs GGUF models on your PC and exposes an HTTP API the phone can call (so models do not run on-device).

1. Install server deps:

```bash
pnpm llm:server:install
```

2. Start the server (downloads models on first run):

```bash
pnpm llm:server
```

3. Point the Expo app at your PC (set your PC LAN IP):

```bash
set EXPO_PUBLIC_LLM_SERVER_URL=http://<YOUR_PC_IP>:3333
pnpm dev
```

Make sure your PC and phone are on the same Wi‑Fi/LAN.

---

If you enjoy using React Native Reusables, please consider giving it a ⭐ on [GitHub](https://github.com/founded-labs/react-native-reusables). Your support means a lot!
=======
## Structure
**State Management**: TodoContext + AsyncStorage for persistent local state across sessions.
>>>>>>> bc605f9540d15bd3338ca8d0cb0868d901be92ab
