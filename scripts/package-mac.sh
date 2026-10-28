#!/bin/zsh
set -euo pipefail
root="${0:A:h:h}"
cd "$root"
./build.sh
version="${VERSION:-1.0.0}"
staging=$(mktemp -d)
trap 'rm -rf "$staging"' EXIT
ditto "build/Wallpaper Generator.app" "$staging/Wallpaper Generator.app"
ln -s /Applications "$staging/Applications"
cp docs/README-for-friends.txt "$staging/README.txt"
mkdir -p dist
hdiutil create -volname "Wallpaper Generator" -srcfolder "$staging" -ov -format UDZO "dist/default_wallpapers-$version-macos-universal.dmg"
cp "build/Wallpaper Generator.zip" "dist/default_wallpapers-$version-macos-universal.zip"
codesign --verify --deep --strict "build/Wallpaper Generator.app"
lipo "build/Wallpaper Generator.app/Contents/MacOS/Wallpaper Generator" -verify_arch arm64 x86_64
hdiutil verify "dist/default_wallpapers-$version-macos-universal.dmg"
