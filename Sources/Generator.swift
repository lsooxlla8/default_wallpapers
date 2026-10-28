// Wallpaper Generator: a menu-bar app that sets default_desktop's generative
// works as the system desktop picture. It shares the engine (Resources/art)
// with default_desktop; there are no widgets, no photos and no network.
import AppKit
import WebKit

let appSupport = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent("Library/Application Support/audio.default.wallpaper-generator", isDirectory: true)
let wallpapersDirectory = appSupport.appendingPathComponent("wallpapers", isDirectory: true)
let saveDirectory = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Documents/Wallpaper Generator", isDirectory: true)
let engineDirectory = Bundle.main.resourceURL!.appendingPathComponent("art", isDirectory: true)

/// Native pixel size of a screen (the panel's own resolution, not the scaled UI size).
func nativePixels(_ screen: NSScreen) -> NSSize {
    guard let number = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber else {
        return NSSize(width: screen.frame.width*screen.backingScaleFactor, height: screen.frame.height*screen.backingScaleFactor) }
    let id = number.uint32Value
    let modes = CGDisplayCopyAllDisplayModes(id, [kCGDisplayShowDuplicateLowResolutionModes: true] as CFDictionary) as? [CGDisplayMode] ?? []
    let mode = modes.filter { ($0.ioFlags & UInt32(kDisplayModeNativeFlag)) != 0 }.max { $0.pixelWidth*$0.pixelHeight < $1.pixelWidth*$1.pixelHeight } ?? CGDisplayCopyDisplayMode(id)
    guard let mode else { return NSSize(width: screen.frame.width*screen.backingScaleFactor, height: screen.frame.height*screen.backingScaleFactor) }
    let rotated = Int(CGDisplayRotation(id).rounded()) % 180 != 0
    return NSSize(width: rotated ? mode.pixelHeight : mode.pixelWidth, height: rotated ? mode.pixelWidth : mode.pixelHeight)
}
func displayKey(_ screen: NSScreen) -> String { (screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.stringValue ?? "main" }

struct Target { let id: String; let size: NSSize }
struct Work: Codable { var id: String; var path: String; var record: [String:AnyCodable] }
/// Minimal JSON value box so the engine's records round-trip through Codable.
struct AnyCodable: Codable {
    let value: Any
    init(_ value: Any) { self.value = value }
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { value = NSNull() } else if let b = try? c.decode(Bool.self) { value = b } else if let n = try? c.decode(Double.self) { value = n }
        else if let s = try? c.decode(String.self) { value = s } else if let a = try? c.decode([AnyCodable].self) { value = a.map { $0.value } }
        else { value = try c.decode([String:AnyCodable].self).mapValues { $0.value } }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch value {
        case let n as NSNumber where CFGetTypeID(n) == CFBooleanGetTypeID(): try c.encode(n.boolValue)
        case let n as NSNumber: try c.encode(n.doubleValue)
        case let s as String: try c.encode(s)
        case let a as [Any]: try c.encode(a.map { AnyCodable($0) })
        case let d as [String:Any]: try c.encode(d.mapValues { AnyCodable($0) })
        default: try c.encodeNil()
        }
    }
}
/// The current set: one work per display, sharing a palette and a seed base.
struct WallpaperSet: Codable { var base: UInt32; var palette: [String]; var works: [Work]; var photos: [[String: String]]? = nil }

/// Renders works in a temporary engine page and releases it afterwards.
final class Renderer: NSObject, WKNavigationDelegate {
    private var web: WKWebView?
    private var completion: ((Result<Any, Error>) -> Void)?
    private var script = ""
    private var arguments: [String: Any] = [:]
    private var timeout: DispatchWorkItem?
    func run(_ script: String, arguments: [String: Any], page: URL? = nil, completion: @escaping (Result<Any, Error>) -> Void) {
        guard self.completion == nil else { completion(.failure(NSError(domain: "Renderer", code: 1, userInfo: [NSLocalizedDescriptionKey: "Рендер уже выполняется"]))); return }
        self.script = script; self.arguments = arguments; self.completion = completion
        let configuration = WKWebViewConfiguration(); configuration.websiteDataStore = .nonPersistent()
        let view = WKWebView(frame: NSRect(x: 0, y: 0, width: 480, height: 270), configuration: configuration)
        view.navigationDelegate = self; web = view
        let deadline = DispatchWorkItem { [weak self] in self?.fail("Превышено время ожидания генератора") }
        timeout = deadline; DispatchQueue.main.asyncAfter(deadline: .now() + 120, execute: deadline)
        let file = page ?? engineDirectory.appendingPathComponent("index.html")
        view.loadFileURL(file, allowingReadAccessTo: file.deletingLastPathComponent())
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.callAsyncJavaScript("for(let i=0;i<500&&!window.Art?.isReady;i++)await new Promise(r=>setTimeout(r,20));if(!window.Art?.isReady)throw Error('Engine not ready');return true;", arguments: [:], in: nil, in: .page) { [weak self] result in
            guard let self, self.completion != nil else { return }
            if case .failure(let error) = result { self.finish(.failure(error)); return }
            webView.callAsyncJavaScript(self.script, arguments: self.arguments, in: nil, in: .page) { [weak self] result in self?.finish(result) }
        }
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { finish(.failure(error)) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { finish(.failure(error)) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { fail("Процесс генератора завершился") }
    private func fail(_ message: String) { finish(.failure(NSError(domain: "Renderer", code: 2, userInfo: [NSLocalizedDescriptionKey: message]))) }
    private func finish(_ result: Result<Any, Error>) {
        guard let callback = completion else { return }; completion = nil; timeout?.cancel(); timeout = nil
        web?.navigationDelegate = nil; web?.stopLoading(); web = nil; arguments = [:]
        callback(result)
    }
}

/// One coherent set: the first display chooses the palette, every display gets
/// its own work (own seed from the base) at its native size and aspect.
let generationScript = """
await DesktopExperiments.setPhotos(photos||[]);
const out=[];let pal=palette&&palette.length===3?palette:null;
for(const t of targets){
  Art.resize(t.w,t.h,1);
  const st=Art.load({seed:t.seed,recent:[],...(fixture?{family:DesktopExperiments.catalogue.find(r=>r.source==="photo").id}:{}),...(pal?{palette:pal}:{})});Art.setVisible(false);
  pal=pal||st.palette;const f=Art.stillFrame(t.w,t.h);
  out.push({id:t.id,png:f.png,record:Art.metadata(),palette:pal});
}
return out;
"""

func seedFor(base: UInt32, id: String) -> UInt32 {
    var h: UInt32 = base ^ 0x9e3779b9
    for byte in id.utf8 { h = (h ^ UInt32(byte)) &* 16777619 }
    return h == 0 ? 1 : h
}

final class Generator: NSObject, NSMenuDelegate {
    private let renderer = Renderer()
    private let controls = DesktopControls()
    private let hotkey = Hotkey()
    private var item: NSStatusItem?
    private var menu: NSMenu?
    private var timer: Timer?
    private var busy = false
    private var set: WallpaperSet?
    private var settings = Settings.read()
    private var preferences: SettingsWindow?
    private var observers: [NSObjectProtocol] = []
    private var lastError = ""
    private var indexURL: URL { appSupport.appendingPathComponent("current.json") }
    func start() {
        do { try FileManager.default.createDirectory(at: wallpapersDirectory, withIntermediateDirectories: true) } catch { report(error); return }
        set = (try? Data(contentsOf: indexURL)).flatMap { try? JSONDecoder().decode(WallpaperSet.self, from: $0) }
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength); self.item = item
        item.button?.image = NSImage(systemSymbolName: "square.stack", accessibilityDescription: "Wallpaper Generator")
        item.button?.toolTip = "Wallpaper Generator"
        let menu = NSMenu(); menu.delegate = self; self.menu = menu; item.menu = menu
        menu.addItem(withTitle: "Сгенерировать обои", action: #selector(generateAll), keyEquivalent: "g")
        menu.addItem(withTitle: "Сохранить скетч + PNG", action: #selector(save), keyEquivalent: "s")
        menu.addItem(.separator())
        menu.addItem(withTitle: "Настройки…", action: #selector(showSettings), keyEquivalent: ",")
        menu.addItem(withTitle: "Открыть папку сохранения", action: #selector(openFolder), keyEquivalent: "")
        menu.addItem(withTitle: "", action: nil, keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: "Выйти", action: #selector(quit), keyEquivalent: "q")
        menu.items.forEach { $0.target = self }
        hotkey.action = { [weak self] in self?.generateAll() }
        if !hotkey.register(settings) { lastError = "Шорткат занят — выберите другой в настройках" }
        schedule(); rebuildControls()
        observers.append(NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in self?.rebuildControls(); self?.updateScreens() })
        observers.append(NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.activeSpaceDidChangeNotification, object: nil, queue: .main) { [weak self] _ in self?.apply() })
        observers.append(NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { [weak self] _ in self?.checkSchedule() })
        if set == nil { generateAll() } else { updateScreens() }
    }
    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.items[0].isEnabled = !busy; menu.items[1].isEnabled = !busy && set != nil
        menu.items[5].title = busy ? "Генерация…" : (lastError.isEmpty ? "Wallpaper Generator 1.0.0" : lastError)
    }
    private func rebuildControls() { controls.rebuild(show: settings.desktopButtons, target: self); controls.setEnabled(!busy) }
    @objc func showSettings() {
        if preferences == nil { preferences = SettingsWindow(settings) { [weak self] value in
            guard let self else { return nil }
            if value.photoSource == "folder" && !value.photoFolder.hasPrefix("/") { return "Выберите папку фотографий" }
            if !self.hotkey.register(value) { _ = self.hotkey.register(self.settings); return "Шорткат занят. Настройки не сохранены: выберите другую комбинацию." }
            do { try value.write(); self.settings = value; self.schedule(); self.rebuildControls(); return nil }
            catch { _ = self.hotkey.register(self.settings); return error.localizedDescription }
        } }
        preferences?.show()
    }
    private func targets(_ screens: [NSScreen]) -> [Target] { screens.map { Target(id: displayKey($0), size: nativePixels($0)) } }
    @objc func generateAll() {
        guard !busy else { return }
        let list = targets(NSScreen.screens); guard !list.isEmpty else { return }
        busy = true; controls.setEnabled(false)
        PhotoSource.sample(settings: settings) { [weak self] photos in self?.render(list, base: UInt32.random(in: 1...UInt32.max), palette: nil, keep: [], photos: photos) }
    }
    private func updateScreens() {
        guard !busy else { return }
        guard let set else { generateAll(); return }
        let missing = targets(NSScreen.screens).filter { t in
            !set.works.contains { $0.id == t.id && FileManager.default.fileExists(atPath: $0.path) && ($0.record["renderSize"]?.value as? [NSNumber])?.map({ $0.intValue }) == [Int(t.size.width), Int(t.size.height)] }
        }
        if missing.isEmpty { apply() } else { busy = true; render(missing, base: set.base, palette: set.palette, keep: set.works, photos: set.photos ?? []) }
    }
    private func render(_ targets: [Target], base: UInt32, palette: [String]?, keep: [Work], photos: [[String: String]]) {
        let list = targets.map { ["id": $0.id, "w": Int($0.size.width), "h": Int($0.size.height), "seed": Int(seedFor(base: base, id: $0.id))] as [String: Any] }
        renderer.run(generationScript, arguments: ["targets": list, "palette": palette ?? [], "photos": photos, "fixture": false]) { [weak self] result in
            guard let self else { return }
            defer { self.busy = false; self.controls.setEnabled(true) }
            do {
                let value = try result.get()
                guard let frames = value as? [[String: Any]], frames.count == targets.count else { throw self.error("Генератор вернул неполный набор экранов") }
                var works = keep.filter { w in !targets.contains { $0.id == w.id } }, chosen = palette ?? []
                for frame in frames {
                    guard let id = frame["id"] as? String, let png = frame["png"] as? String, let comma = png.firstIndex(of: ","), let data = Data(base64Encoded: String(png[png.index(after: comma)...])), let record = frame["record"] as? [String: Any], let image = NSBitmapImageRep(data: data), let target = targets.first(where: { $0.id == id }), image.pixelsWide == Int(target.size.width), image.pixelsHigh == Int(target.size.height) else { throw self.error("Некорректный кадр генератора") }
                    let url = wallpapersDirectory.appendingPathComponent("wallpaper-\(UUID().uuidString).png")
                    try data.write(to: url, options: .atomic)
                    works.append(Work(id: id, path: url.path, record: record.mapValues { AnyCodable($0) }))
                    if chosen.isEmpty { chosen = frame["palette"] as? [String] ?? [] }
                }
                let next = WallpaperSet(base: base, palette: chosen, works: works, photos: photos)
                try JSONEncoder().encode(next).write(to: self.indexURL, options: .atomic)
                let previous = self.set; self.set = next; self.lastError = ""; self.apply(); self.prune(keeping: [next, previous])
                UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "lastGeneration")
            } catch { self.report(error) }
        }
    }
    private func error(_ message: String) -> NSError { NSError(domain: "Wallpaper Generator", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
    private func report(_ error: Error) { lastError = error.localizedDescription; item?.button?.toolTip = "Wallpaper Generator: " + lastError; NSLog("%@", lastError) }
    private func apply() {
        guard let set else { return }
        for screen in NSScreen.screens {
            guard let work = set.works.first(where: { $0.id == displayKey(screen) }) else { continue }
            let url = URL(fileURLWithPath: work.path)
            if NSWorkspace.shared.desktopImageURL(for: screen) != url {
                do { try NSWorkspace.shared.setDesktopImageURL(url, for: screen, options: [.imageScaling: NSImageScaling.scaleProportionallyUpOrDown.rawValue, .allowClipping: true]) } catch { report(error) }
            }
        }
    }
    private func prune(keeping sets: [WallpaperSet?]) {
        let keep = Set(sets.compactMap { $0 }.flatMap { $0.works.map { $0.path } })
        for name in (try? FileManager.default.contentsOfDirectory(atPath: wallpapersDirectory.path)) ?? [] where name.hasPrefix("wallpaper-") && name.hasSuffix(".png") {
            let path = wallpapersDirectory.appendingPathComponent(name).path
            if !keep.contains(path) { try? FileManager.default.removeItem(atPath: path) }
        }
    }
    @objc func save() {
        guard !busy, let set, let work = set.works.first(where: { $0.id == (NSScreen.main.map(displayKey) ?? "") }) ?? set.works.first else { return }
        do {
            let record = work.record.mapValues { $0.value }
            let folder = URL(fileURLWithPath: settings.saveFolder, isDirectory: true).appendingPathComponent("work-\(Int(Date().timeIntervalSince1970))-\(UUID().uuidString.prefix(8))", isDirectory: true)
            try exportWork(record: record, photos: set.photos ?? [], png: URL(fileURLWithPath: work.path), folder: folder)
            lastError = ""; item?.button?.toolTip = "Сохранено: " + folder.path
        } catch { report(error) }
    }
    private func schedule() {
        timer?.invalidate(); timer = nil
        guard settings.intervalMinutes > 0 else { return }
        timer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in self?.checkSchedule() }; timer?.tolerance = 5
    }
    private func checkSchedule() {
        guard settings.intervalMinutes > 0 else { return }
        let last = UserDefaults.standard.double(forKey: "lastGeneration")
        if Date().timeIntervalSince1970 - last >= Double(settings.intervalMinutes * 60) { generateAll() }
    }
    @objc func openFolder() {
        let folder = URL(fileURLWithPath: settings.saveFolder, isDirectory: true)
        do { try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true); NSWorkspace.shared.open(folder) } catch { report(error) }
    }
    @objc func quit() { NSApp.terminate(nil) }
}

func exportWork(record: [String: Any], photos: [[String: String]], png: URL, folder: URL) throws {
    let fm = FileManager.default
    guard !fm.fileExists(atPath: folder.path) else { throw CocoaError(.fileWriteFileExists) }
    try fm.createDirectory(at: folder, withIntermediateDirectories: true)
    do {
        let manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: engineDirectory.appendingPathComponent("engine.json"))) as! [String: Any]
        let scripts = (manifest["scripts"] as! [String]).filter { $0 != "p5.min.js" && $0 != "sketches.js" }
        let engine = try scripts.map { try String(contentsOf: engineDirectory.appendingPathComponent($0), encoding: .utf8) }.joined(separator: "\n\n")
        let renderer = try String(contentsOf: engineDirectory.appendingPathComponent("sketches.js"), encoding: .utf8)
        let size = record["renderSize"] as? [NSNumber] ?? [1920, 1080]
        let parameters = String(data: try JSONSerialization.data(withJSONObject: record, options: [.sortedKeys]), encoding: .utf8)!
        let ids = photoIDs(record)
        let selected = photos.filter { ids.contains($0["id"] ?? "") }
        let photoJSON = String(data: try JSONSerialization.data(withJSONObject: selected, options: [.sortedKeys]), encoding: .utf8)!
        let source = "window.DEFAULT_DESKTOP_WIDTH=\(size[0]);window.DEFAULT_DESKTOP_HEIGHT=\(size[1]);window.DEFAULT_DESKTOP_DENSITY=1;window.DEFAULT_DESKTOP_SKETCH=\(parameters);\n" + engine + "\nDesktopExperiments.setPhotos(\(photoJSON)).then(()=>{\n" + renderer + "\n});\n"
        try Data(source.utf8).write(to: folder.appendingPathComponent("sketch.js"))
        let html = "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Wallpaper Generator — p5.js</title><style>html,body{margin:0;background:#050505}body{min-height:100vh;display:grid;place-items:center}canvas{display:block;max-width:100vw;max-height:100vh;width:auto!important;height:auto!important}</style><script src=\"p5.min.js\"></script></head><body><script src=\"sketch.js\"></script></body></html>"
        try Data(html.utf8).write(to: folder.appendingPathComponent("index.html"))
        try JSONSerialization.data(withJSONObject: record, options: [.prettyPrinted, .sortedKeys]).write(to: folder.appendingPathComponent("recipe.json"))
        for name in ["p5.min.js", "p5-LICENSE.txt"] { try fm.copyItem(at: engineDirectory.appendingPathComponent(name), to: folder.appendingPathComponent(name)) }
        try fm.copyItem(at: png, to: folder.appendingPathComponent("wallpaper.png"))
    } catch { try? fm.removeItem(at: folder); throw error }
}
func photoIDs(_ value: Any) -> Set<String> {
    if let d = value as? [String: Any] { return d.reduce(into: Set<String>()) { result, pair in if pair.key == "photo", let id = pair.value as? String { result.insert(id) } else { result.formUnion(photoIDs(pair.value)) } } }
    if let a = value as? [Any] { return a.reduce(into: Set<String>()) { $0.formUnion(photoIDs($1)) } }
    return []
}

// --simulate-screens WxH,WxH,... <outDir>: renders a set for fake displays into
// files (no desktop pictures are changed). Used to check multi-display logic.
