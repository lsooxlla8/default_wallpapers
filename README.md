# default_wallpapers

**default_wallpaper** creates procedural wallpapers, sets them as the system
background, and exports the original animated p5.js sketch. A standalone app
without widgets, Obsidian, Telegram, accounts or network access.

[Скачать / Download](https://github.com/lsooxlla8/default_wallpapers/releases/latest)

![Generative artwork examples](docs/examples.jpg)

## Install

| Platform | Download | Installation |
| --- | --- | --- |
| macOS 14+, Apple Silicon + Intel | `macos-universal.dmg` | Drag the app into Applications |
| Windows 10/11, x64 | `windows-x64-setup.exe` | Run the installer; choose a per-user destination |
| Linux, x64 | `.deb` or `.AppImage` | Package manager, or make AppImage executable |

This release has no verified publisher certificate: macOS is ad-hoc signed and
not notarized; Windows has no publisher signature. Your OS may require explicit
approval. On macOS use **System Settings → Privacy & Security → Open Anyway**
for your verified download. AppImage needs FUSE 2, or `--appimage-extract-and-run`.

## Controls and settings

The tray menu always offers **Generate**, **Save sketch + PNG**, **Settings**,
**Open export folder**, and **Quit**. Settings are saved automatically:

- Change frequency: manual only, 1/5/15/30 minutes, 1/2/6/12 hours, or daily.
- Photo source: system Photos on macOS; the Pictures directory on Windows/Linux;
  a chosen local directory; or no photos. Custom directories are read one level
  deep. Photos are ingredients for experimental compositions, not an ordinary
  photo slideshow. macOS Photos permission is requested explicitly in Settings.
- Choose where completed projects are saved.
- Optionally show Generate/Save buttons on the desktop **in addition to the tray**.
  On Linux these are a compact control panel. Disabled by default.
- Assign a global generation shortcut. Disabled by default; conflicts are reported.
  Wayland/compositor restrictions can prevent global shortcut registration.

Save creates a fresh project directory with `wallpaper.png`, `recipe.json`,
`index.html`, `sketch.js`, `p5.min.js`, and the p5.js license. Open `index.html` in a
browser to play the animation. Used photographs are embedded so the project can
be moved; unused photographs are omitted. Nothing is uploaded.

With multiple screens, works share a palette. macOS and Windows use individual
images. KDE Plasma has a per-screen adapter; compositor monitor ordering needs
hardware verification. GNOME, XFCE, Cinnamon and MATE use one generated work on
all displays. Other Linux desktops can still render and save projects but cannot
apply them automatically. GNOME may need an AppIndicator extension for the tray;
launching the app again opens Settings if the tray is unavailable.

The generator is released after rendering; wallpapers are static system pictures,
while exported sketches are animated. On Windows/Linux the Electron tray process
remains running. macOS uses AppKit/WebKit. Desktop pictures can remain after quit.

## Build and verification

```sh
# macOS: Xcode command line tools, Python 3
./scripts/package-mac.sh       # universal .app, DMG and ZIP

# Windows/Linux: Node 22+ (npm ci downloads Electron)
npm ci
npm test
npm start
npm run dist:win              # Windows NSIS EXE
npm run dist:linux            # Linux AppImage + DEB
```

GitHub Actions builds each platform on its own runner. Verification covers native
self-tests, settings/persistence and Linux adapter tests, renderer output,
portrait/landscape compositions, source export including photos, and pixel-exact
photo export replay in Chromium. Windows CI also applies an image through the
actual wallpaper COM API. No CI result proves your physical monitor layout,
keyboard/compositor behavior, or macOS Photos permission flow.

Runtime data: macOS `~/Library/Application Support/audio.default.wallpaper`;
Windows/Linux use Electron's per-user `default_wallpaper` data directory.
Uninstallation does not remove exported projects. No `default_desktop` data is migrated.

## Engine and licenses

Original p5.js / Canvas 2D procedural code: 244 families, nine composition engines,
including line systems, hidden-line 3D plotter drawings, instrument graphics,
simulations, pixel sorting, datamoshing, displacement, collage, image-as-audio,
FFT/DCT faults and feedback. Saved recipes preserve the composition and seed.

`art/p5.min.js` is p5.js 2.3.4 (LGPL-2.1); see `art/p5-LICENSE.txt` and
[third-party notices](THIRD_PARTY_NOTICES.md). Electron packages contain their own
license notices. No open-source license has been chosen for the original app and
artwork-engine code.

## По-русски

Отдельное приложение только для генерации обоев и управления ими. В трее всегда
доступны генерация, сохранение и настройки. В настройках выбираются частота смены,
системная фототека или папка фотографий, папка сохранения, глобальный шорткат и
дополнительные кнопки на рабочем столе. Кнопки не заменяют меню трея.

Сохранение: PNG и автономный анимированный p5.js-проект с исходниками, рецептом и
использованными фотографиями. Работает без сети и интеграций. Установщики и
ограничения платформ перечислены выше; подробная инструкция —
[README для установки](docs/README-for-friends.txt).
