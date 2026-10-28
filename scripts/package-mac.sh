#!/bin/zsh
set -euo pipefail
root="${0:A:h:h}"
cd "$root"
./build.sh
version="${VERSION:-1.0.0}"
staging=$(mktemp -d)
trap 'rm -rf "$staging"' EXIT
ditto "build/default_wallpaper.app" "$staging/default_wallpaper.app"
ln -s /Applications "$staging/Applications"
cp docs/README-for-friends.txt "$staging/README.txt"
mkdir -p dist
hdiutil create -volname "default_wallpaper" -srcfolder "$staging" -ov -format UDZO "dist/default_wallpaper-$version-macos-universal.dmg"
cp "build/default_wallpaper.zip" "dist/default_wallpaper-$version-macos-universal.zip"
codesign --verify --deep --strict "build/default_wallpaper.app"
lipo "build/default_wallpaper.app/Contents/MacOS/default_wallpaper" -verify_arch arm64 x86_64
hdiutil verify "dist/default_wallpaper-$version-macos-universal.dmg"
