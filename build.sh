#!/bin/zsh
# Builds build/default_wallpaper.app (universal, ad-hoc signed) and
# build/default_wallpaper.zip (app + README for friends).
set -eu
root="${0:A:h}"
build="$root/build"
app="$build/default_wallpaper.app"
version="${VERSION:-1.0.0}"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
tmp=$(mktemp -d)
for arch in arm64 x86_64; do
  xcrun swiftc -O -target $arch-apple-macos14.0 "$root/Sources/"*.swift -o "$tmp/gen-$arch" -framework AppKit -framework WebKit -framework Photos -framework Carbon
done
lipo -create "$tmp/gen-arm64" "$tmp/gen-x86_64" -output "$app/Contents/MacOS/default_wallpaper"
ditto "$root/art" "$app/Contents/Resources/art"
cp "$root/assets/icon.png" "$app/Contents/Resources/fixture.png"
mkdir -p "$app/Contents/Resources/desktop" "$app/Contents/Resources/assets"
for file in settings.html settings.js ui.css native-bridge.js; do cp "$root/desktop/$file" "$app/Contents/Resources/desktop/$file"; done
ditto "$root/assets/fonts" "$app/Contents/Resources/assets/fonts"
/usr/bin/python3 - "$app" "$version" <<'PY'
import plistlib,sys,pathlib
app=pathlib.Path(sys.argv[1])
p={'CFBundleName':'default_wallpaper','CFBundleDisplayName':'default_wallpaper','CFBundleIdentifier':'audio.default.wallpaper','CFBundleExecutable':'default_wallpaper','CFBundlePackageType':'APPL','CFBundleShortVersionString':sys.argv[2],'CFBundleVersion':'1','CFBundleIconFile':'AppIcon','NSPhotoLibraryUsageDescription':'Use local photos to generate wallpapers. You can choose a folder or disable photos in Settings.','CFBundleDevelopmentRegion':'en','CFBundleLocalizations':['en'],'LSUIElement':True,'NSHighResolutionCapable':True,'NSPrincipalClass':'NSApplication','LSMinimumSystemVersion':'14.0'}
(app/'Contents/Info.plist').write_bytes(plistlib.dumps(p))
PY
if [[ -f "$root/assets/AppIcon.icns" ]]; then cp "$root/assets/AppIcon.icns" "$app/Contents/Resources/AppIcon.icns"; fi
codesign --force --deep --sign - "$app"
pack="$tmp/default_wallpaper"; mkdir -p "$pack"; ditto "$app" "$pack/default_wallpaper.app"; cp "$root/docs/README-for-friends.txt" "$pack/README.txt"
(cd "$build" && ditto -c -k --keepParent "$pack" "default_wallpaper.zip")
rm -rf "$tmp"
"$app/Contents/MacOS/default_wallpaper" --self-test
echo "$app"
