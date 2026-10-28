default_wallpaper 1.0.0 — default_wallpapers

macOS 14+: open the DMG, drag default_wallpaper to Applications.
The build is ad-hoc signed, not notarized. If macOS blocks it, use System Settings
> Privacy & Security > Open Anyway, only after checking that this is your download.
Apple Silicon and Intel are included in one app. No admin access is needed if you
put it in your personal ~/Applications directory instead.

Windows 10/11 x64: run the setup EXE. Choose a per-user installation directory.
This release has no publisher signature; Windows may show a reputation warning.

Linux x64: on Ubuntu 24.04+ prefer the DEB (it installs an AppArmor profile).
AppImage requires a system that permits its Chromium sandbox.
Install the DEB with your package manager, or make the AppImage
executable and launch it. AppImage needs FUSE 2, or use --appimage-extract-and-run.

The tray menu always has Generate, Save, Settings, Open export folder and Quit.
Settings: change interval (including manual only), photo source, export folder,
optional desktop buttons, and an optional global keyboard shortcut.
Shortcuts are disabled until assigned. A conflicting shortcut is reported.
Desktop buttons add another way to generate/save; they do not replace the tray.
Linux uses a compact control panel; GNOME may need an AppIndicator tray extension.
If the tray is unavailable, launch the app again to open Settings.

macOS: system Photos access is optional and requested from Settings.
Windows/Linux: the system Pictures directory is the default photo source.
A custom photo directory uses files directly inside that directory, not subfolders.
You can choose “No photos” for purely procedural art.

Save creates a new folder containing wallpaper.png, recipe.json and a standalone
animated p5.js project. Used photographs are included in that project; unused
sampled photographs are omitted. Everything works offline.
Multiple screens share a palette. macOS and Windows support individual images;
Linux GNOME/XFCE/Cinnamon/MATE use one generated work on all screens.
KDE Plasma has a per-screen adapter; monitor ordering needs checking on hardware.

Data: macOS ~/Library/Application Support/audio.default.wallpaper
Windows/Linux: the Electron userData directory for “default_wallpaper”.
Uninstalling does not remove saved projects. The last system wallpaper remains.

Build/CI verification is documented in the GitHub release. It does not substitute
for checking your particular desktop environment and monitor arrangement.
