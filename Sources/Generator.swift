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
struct WallpaperSet: Codable { var base: UInt32; var palette: [String]; var works: [Work] }

/// Renders works in a temporary engine page and releases it afterwards.
final class Renderer: NSObject, WKNavigationDelegate {
    private var web: WKWebView?
    private var queue: [() -> Void] = []
    private var ready = false
    func run(_ script: String, arguments: [String:Any], completion: @escaping (Result<Any, Error>) -> Void) {
        let job = { [weak self] in
            guard let self, let web = self.web else { return }
            web.callAsyncJavaScript(script, arguments: arguments, in: nil, in: .page) { result in
                completion(result.map { $0 ?? NSNull() }); self.release()
            }
        }
        if ready { job() } else { queue.append(job); start() }
    }
    private func start() {
        guard web == nil else { return }
        let configuration = WKWebViewConfiguration(); configuration.websiteDataStore = .nonPersistent()
        let view = WKWebView(frame: NSRect(x: 0, y: 0, width: 480, height: 270), configuration: configuration)
        view.navigationDelegate = self; web = view
        view.loadFileURL(engineDirectory.appendingPathComponent("index.html"), allowingReadAccessTo: engineDirectory)
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.callAsyncJavaScript("for(let i=0;i<300&&!window.Art?.isReady;i++)await new Promise(r=>setTimeout(r,20));return !!window.Art?.isReady;", arguments: [:], in: nil, in: .page) { [weak self] _ in
            guard let self else { return }; self.ready = true
            let jobs = self.queue; self.queue = []; jobs.forEach { $0() }
        }
    }
    private func release() {
        guard queue.isEmpty, let view = web else { return }
        view.navigationDelegate = nil; view.stopLoading(); view.loadHTMLString("", baseURL: nil)
        web = nil; ready = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { _ = view }
    }
}

/// One coherent set: the first display chooses the palette, every display gets
/// its own work (own seed from the base) at its native size and aspect.
let generationScript = """
const out=[];let pal=palette&&palette.length===3?palette:null;
for(const t of targets){
  Art.resize(t.w,t.h,1);
  const st=Art.load({seed:t.seed,recent:[],...(pal?{palette:pal}:{})});Art.setVisible(false);
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

final class Generator: NSObject {
    private let renderer = Renderer()
    private var item: NSStatusItem?
    private var hourly: NSMenuItem!
    private var timer: Timer?
    private var busy = false
    private var set: WallpaperSet?
    private var observers: [NSObjectProtocol] = []
    private var indexURL: URL { appSupport.appendingPathComponent("current.json") }

    func start() {
        try? FileManager.default.createDirectory(at: wallpapersDirectory, withIntermediateDirectories: true)
        set = (try? Data(contentsOf: indexURL)).flatMap { try? JSONDecoder().decode(WallpaperSet.self, from: $0) }
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength); self.item = item
        item.button?.title = "◫"; item.button?.toolTip = "Wallpaper Generator"
        let menu = NSMenu()
        menu.addItem(withTitle: "Сгенерировать для всех экранов", action: #selector(generateAll), keyEquivalent: "g")
        menu.addItem(withTitle: "Сохранить (анимированный скетч + PNG)", action: #selector(save), keyEquivalent: "s")
        hourly = menu.addItem(withTitle: "Менять каждый час", action: #selector(toggleHourly), keyEquivalent: "")
        menu.addItem(withTitle: "Открыть папку", action: #selector(openFolder), keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: "Выйти", action: #selector(quit), keyEquivalent: "q")
        menu.items.forEach { $0.target = self }; item.menu = menu
        hourly.state = UserDefaults.standard.bool(forKey: "hourly") ? .on : .off
        scheduleHourly()
        // New displays get their own work from the same base and palette;
        // displays that already have one keep it.
        observers.append(NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in self?.updateScreens() })
        observers.append(NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.activeSpaceDidChangeNotification, object: nil, queue: .main) { [weak self] _ in self?.apply() })
        if set == nil { generateAll() } else { updateScreens() }
    }
    private func targets(_ screens: [NSScreen]) -> [Target] { screens.map { Target(id: displayKey($0), size: nativePixels($0)) } }
    @objc func generateAll() { render(targets(NSScreen.screens), base: UInt32.random(in: 1...UInt32.max), palette: nil, keep: []) }
    private func updateScreens() {
        guard let set else { generateAll(); return }
        let missing = targets(NSScreen.screens).filter { t in !set.works.contains { $0.id == t.id && FileManager.default.fileExists(atPath: $0.path) } }
        if missing.isEmpty { apply() } else { render(missing, base: set.base, palette: set.palette, keep: set.works) }
    }
    func render(_ targets: [Target], base: UInt32, palette: [String]?, keep: [Work], completion: (() -> Void)? = nil) {
        guard !busy, !targets.isEmpty else { completion?(); return }
        busy = true; item?.button?.title = "◌"
        let list = targets.map { ["id": $0.id, "w": Int($0.size.width), "h": Int($0.size.height), "seed": Int(seedFor(base: base, id: $0.id))] as [String:Any] }
        renderer.run(generationScript, arguments: ["targets": list, "palette": palette ?? []]) { [weak self] result in
            guard let self else { return }
            defer { self.busy = false; self.item?.button?.title = "◫"; completion?() }
            guard case .success(let value) = result, let frames = value as? [[String:Any]] else { NSSound.beep(); return }
            let stamp = Int(Date().timeIntervalSince1970*1000)
            var works = keep.filter { w in !frames.contains { ($0["id"] as? String) == w.id } }, chosen = palette ?? []
            for frame in frames {
                guard let id = frame["id"] as? String, let png = frame["png"] as? String, let comma = png.firstIndex(of: ","),
                      let data = Data(base64Encoded: String(png[png.index(after: comma)...])), let record = frame["record"] as? [String:Any] else { continue }
                let url = wallpapersDirectory.appendingPathComponent("wallpaper-\(base)-\(stamp)-\(id).png")
                guard (try? data.write(to: url, options: .atomic)) != nil else { continue }
                works.append(Work(id: id, path: url.path, record: record.mapValues { AnyCodable($0) }))
                if chosen.isEmpty { chosen = frame["palette"] as? [String] ?? [] }
            }
            let previous = self.set
            self.set = WallpaperSet(base: base, palette: chosen, works: works)
            if let data = try? JSONEncoder().encode(self.set) { try? data.write(to: self.indexURL, options: .atomic) }
            self.apply(); self.prune(keeping: [self.set, previous])
        }
    }
    private func apply() {
        guard let set else { return }
        let fill = set.palette.first.flatMap { hex -> NSColor? in
            let v = [1,3,5].compactMap { Int(hex.dropFirst($0).prefix(2), radix: 16) }
            return v.count == 3 ? NSColor(calibratedRed: CGFloat(v[0])/255, green: CGFloat(v[1])/255, blue: CGFloat(v[2])/255, alpha: 1) : nil } ?? .black
        for screen in NSScreen.screens {
            guard let work = set.works.first(where: { $0.id == displayKey(screen) }) else { continue }
            let url = URL(fileURLWithPath: work.path)
            if NSWorkspace.shared.desktopImageURL(for: screen) != url {
                try? NSWorkspace.shared.setDesktopImageURL(url, for: screen, options: [.imageScaling: NSImageScaling.scaleProportionallyUpOrDown.rawValue, .allowClipping: true, .fillColor: fill])
            }
        }
    }
    private func prune(keeping sets: [WallpaperSet?]) {
        let keep = Set(sets.compactMap { $0 }.flatMap { $0.works.map { $0.path } })
        for name in (try? FileManager.default.contentsOfDirectory(atPath: wallpapersDirectory.path)) ?? [] where name.hasSuffix(".png") {
            let path = wallpapersDirectory.appendingPathComponent(name).path
            if !keep.contains(path) { try? FileManager.default.removeItem(atPath: path) }
        }
    }
    /// Saves the main display's work: a self-contained animated p5.js project
    /// (index.html, sketch.js, p5.min.js, licence) and the still PNG.
    @objc func save() {
        guard let set, let work = set.works.first(where: { $0.id == displayKey(NSScreen.main ?? NSScreen.screens[0]) }) ?? set.works.first else { return }
        do {
            let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd_HH-mm-ss"
            let record = work.record.mapValues { $0.value }
            let folder = saveDirectory.appendingPathComponent("\(f.string(from: Date()))_\(record["seed"] as? NSNumber ?? 0)", isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: engineDirectory.appendingPathComponent("engine.json"))) as? [String:Any]
            let scripts = (manifest?["scripts"] as? [String] ?? []).filter { $0 != "p5.min.js" }
            let engine = try scripts.map { try String(contentsOf: engineDirectory.appendingPathComponent($0), encoding: .utf8) }.joined(separator: "\n\n")
            let size = record["renderSize"] as? [NSNumber]
            let parameters = String(data: try JSONSerialization.data(withJSONObject: record, options: [.sortedKeys]), encoding: .utf8)!
            let source = """
            // p5.js sketch saved by Wallpaper Generator (default_desktop engine).
            window.DEFAULT_DESKTOP_WIDTH = \(size?.first?.intValue ?? 1920);
            window.DEFAULT_DESKTOP_HEIGHT = \(size?.last?.intValue ?? 1080);
            window.DEFAULT_DESKTOP_DENSITY = 1;
            window.DEFAULT_DESKTOP_SKETCH = \(parameters);

            \(engine)
            """
            try Data(source.utf8).write(to: folder.appendingPathComponent("sketch.js"))
            let html = """
            <!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <title>p5.js sketch</title><style>html,body{margin:0;min-height:100%;background:#050505}body{min-height:100vh;display:grid;place-items:center}canvas{display:block;max-width:100vw;max-height:100vh;width:auto!important;height:auto!important}</style>
            <script src="p5.min.js"></script></head><body><script src="sketch.js"></script></body></html>
            """
            try Data(html.utf8).write(to: folder.appendingPathComponent("index.html"))
            for name in ["p5.min.js", "p5-LICENSE.txt"] { try FileManager.default.copyItem(at: engineDirectory.appendingPathComponent(name), to: folder.appendingPathComponent(name)) }
            try FileManager.default.copyItem(at: URL(fileURLWithPath: work.path), to: folder.appendingPathComponent("wallpaper.png"))
            NSWorkspace.shared.activateFileViewerSelecting([folder])
        } catch { NSSound.beep() }
    }
    @objc func toggleHourly() {
        let on = hourly.state != .on; hourly.state = on ? .on : .off
        UserDefaults.standard.set(on, forKey: "hourly"); scheduleHourly()
    }
    private func scheduleHourly() {
        timer?.invalidate(); timer = nil
        guard hourly.state == .on else { return }
        let t = Timer(timeInterval: 3600, repeats: true) { [weak self] _ in self?.generateAll() }
        t.tolerance = 60; RunLoop.main.add(t, forMode: .common); timer = t
    }
    @objc func openFolder() {
        try? FileManager.default.createDirectory(at: saveDirectory, withIntermediateDirectories: true)
        NSWorkspace.shared.open(saveDirectory)
    }
    @objc func quit() { NSApp.terminate(nil) }
}

// --simulate-screens WxH,WxH,... <outDir>: renders a set for fake displays into
// files (no desktop pictures are changed). Used to check multi-display logic.
let arguments = CommandLine.arguments
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
if let i = arguments.firstIndex(of: "--simulate-screens"), arguments.count > i+2 {
    let sizes = arguments[i+1].split(separator: ",").compactMap { s -> NSSize? in let p = s.split(separator: "x"); return p.count == 2 ? NSSize(width: Double(p[0])!, height: Double(p[1])!) : nil }
    let out = URL(fileURLWithPath: arguments[i+2], isDirectory: true)
    try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
    let renderer = Renderer(), base = UInt32(arguments.count > i+3 ? UInt32(arguments[i+3]) ?? 7 : 7)
    let list = sizes.enumerated().map { ["id": "sim\($0.offset)", "w": Int($0.element.width), "h": Int($0.element.height), "seed": Int(seedFor(base: base, id: "sim\($0.offset)"))] as [String:Any] }
    renderer.run(generationScript, arguments: ["targets": list, "palette": []]) { result in
        guard case .success(let value) = result, let frames = value as? [[String:Any]] else { print("render failed", result); exit(1) }
        var report: [[String:Any]] = []
        for frame in frames {
            let id = frame["id"] as? String ?? "?", png = frame["png"] as? String ?? ""
            if let comma = png.firstIndex(of: ","), let data = Data(base64Encoded: String(png[png.index(after: comma)...])) { try? data.write(to: out.appendingPathComponent("\(id).png")) }
            let record = frame["record"] as? [String:Any] ?? [:]
            report.append(["id": id, "seed": record["seed"] ?? 0, "palette": record["palette"] ?? [], "renderSize": record["renderSize"] ?? [], "engine": (record["composition"] as? [String:Any])?["engine"] ?? "single"])
        }
        if let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted]) { try? data.write(to: out.appendingPathComponent("report.json")); print(String(data: data, encoding: .utf8)!) }
        exit(0)
    }
    app.run()
} else {
    let generator = Generator()
    generator.start()
    app.run()
}
