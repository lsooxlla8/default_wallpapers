Wallpaper Generator

A small menu-bar app (icon ◫ in the menu bar) that creates generative wallpapers
and sets them as the desktop picture on every screen (also shown on the lock screen).

First launch (the app is not notarized):
  right-click "Wallpaper Generator.app" → Open → Open
  or in Terminal:  xattr -dr com.apple.quarantine "/path/to/Wallpaper Generator.app"

Menu:
  Сгенерировать для всех экранов — a new set: one work per screen, same palette
  Сохранить — saves the main screen's work as an animated p5.js sketch (open
              index.html) plus the PNG, into Documents/Wallpaper Generator
  Менять каждый час — on/off
  Открыть папку — opens Documents/Wallpaper Generator
  Выйти

Works offline, uses no photos and no accounts. Needs macOS 14 or newer (Apple
silicon and Intel). Data: ~/Library/Application Support/audio.default.wallpaper-generator
