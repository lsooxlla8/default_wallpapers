#!/bin/zsh
# Builds build/Wallpaper Generator.app (universal, ad-hoc signed) and
# build/Wallpaper Generator.zip (app + README for friends).
set -eu
root="${0:A:h}"
build="$root/build"
app="$build/Wallpaper Generator.app"
version="${VERSION:-1.0.0}"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
tmp=$(mktemp -d)
for arch in arm64 x86_64; do
  xcrun swiftc -O -target $arch-apple-macos14.0 "$root/Sources/"*.swift -o "$tmp/gen-$arch" -framework AppKit -framework WebKit -framework Photos -framework Carbon
done
lipo -create "$tmp/gen-arm64" "$tmp/gen-x86_64" -output "$app/Contents/MacOS/Wallpaper Generator"
ditto "$root/art" "$app/Contents/Resources/art"
cp "$root/assets/icon.png" "$app/Contents/Resources/fixture.png"
/usr/bin/python3 - "$app" "$version" <<'PY'
import plistlib,sys,pathlib
app=pathlib.Path(sys.argv[1])
p={'CFBundleName':'Wallpaper Generator','CFBundleDisplayName':'Wallpaper Generator','CFBundleIdentifier':'audio.default.wallpaper-generator','CFBundleExecutable':'Wallpaper Generator','CFBundlePackageType':'APPL','CFBundleShortVersionString':sys.argv[2],'CFBundleVersion':'1','CFBundleIconFile':'AppIcon','NSPhotoLibraryUsageDescription':'Выбранные локальные фотографии используются для генерации обоев. Можно выбрать папку или отключить фотографии в настройках.','LSUIElement':True,'NSHighResolutionCapable':True,'NSPrincipalClass':'NSApplication','LSMinimumSystemVersion':'14.0'}
(app/'Contents/Info.plist').write_bytes(plistlib.dumps(p))
PY
if [[ -f "$root/assets/AppIcon.icns" ]]; then cp "$root/assets/AppIcon.icns" "$app/Contents/Resources/AppIcon.icns"; fi
codesign --force --deep --sign - "$app"
pack="$tmp/Wallpaper Generator"; mkdir -p "$pack"; ditto "$app" "$pack/Wallpaper Generator.app"; cp "$root/docs/README-for-friends.txt" "$pack/README.txt"
(cd "$build" && ditto -c -k --keepParent "$pack" "Wallpaper Generator.zip")
rm -rf "$tmp"
"$app/Contents/MacOS/Wallpaper Generator" --self-test
echo "$app"
