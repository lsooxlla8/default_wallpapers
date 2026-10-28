# 1.0.0 release checks

- App name: `default_wallpaper`; repository: `default_wallpapers`.
- English interface, default_audio plugin palette/font/geometry, existing dice/floppy icons.
- Tray actions remain available when optional desktop buttons are enabled.
- Manual/timed generation; chosen photo source and export destination; shortcut registration/conflicts.
- Native universal macOS build, DMG/ZIP; Windows x64 NSIS installer; Linux x64 DEB/AppImage.
- Native and JavaScript checks; render dimensions; self-contained photo export replay.
- Windows installed-app smoke test; Linux packaged-app smoke test.
- Final UI captures inspected at native resolution.
- p5.js/Electron/Chromium/JetBrains Mono notices included.
- SHA-256 checksums; remote release assets downloaded and matched.

Limitations to report: unsigned Windows publisher, ad-hoc/non-notarized macOS;
macOS Photos permission and real monitor/compositor/keyboard behavior are not
fully verified by CI. Linux adapters have environment-specific restrictions.
No installation or GUI control on the user's Mac is part of this release task.
