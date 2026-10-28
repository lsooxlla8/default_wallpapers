import AppKit
import Carbon
import Photos
import WebKit

struct Settings: Codable {
    var intervalMinutes: Int = 60
    var photoSource: String = "system"
    var photoFolder: String = ""
    var saveFolder: String = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Documents/default_wallpaper").path
    var desktopButtons: Bool = false
    var shortcutKey: Int = -1
    var shortcutModifiers: UInt32 = 0
    var shortcutLabel: String = ""
    static let intervals = [0, 1, 5, 15, 30, 60, 120, 360, 720, 1440]
    static var file: URL { appSupport.appendingPathComponent("settings.json") }
    static func read() -> Settings {
        guard let data = try? Data(contentsOf: file), var settings = try? JSONDecoder().decode(Settings.self, from: data) else { return Settings() }
        if !intervals.contains(settings.intervalMinutes) { settings.intervalMinutes = 60 }
        if !["system", "folder", "none"].contains(settings.photoSource) { settings.photoSource = "none" }
        return settings
    }
    func write() throws { try JSONEncoder().encode(self).write(to: Self.file, options: .atomic) }
}

final class Hotkey {
    private var reference: EventHotKeyRef?
    private var handler: EventHandlerRef?
    var action: (() -> Void)?
    init() {
        var type = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(), { _, event, context -> OSStatus in
            guard let context, let event else { return OSStatus(eventNotHandledErr) }
            var id = EventHotKeyID()
            GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID), nil, MemoryLayout<EventHotKeyID>.size, nil, &id)
            guard id.signature == 0x44575047, id.id == 1 else { return OSStatus(eventNotHandledErr) }
            Unmanaged<Hotkey>.fromOpaque(context).takeUnretainedValue().action?()
            return noErr
        }, 1, &type, Unmanaged.passUnretained(self).toOpaque(), &handler)
    }
    func register(_ settings: Settings) -> Bool {
        if let reference { UnregisterEventHotKey(reference); self.reference = nil }
        guard settings.shortcutKey >= 0 else { return true }
        return RegisterEventHotKey(UInt32(settings.shortcutKey), settings.shortcutModifiers, EventHotKeyID(signature: 0x44575047, id: 1), GetApplicationEventTarget(), 0, &reference) == noErr
    }
    deinit { if let reference { UnregisterEventHotKey(reference) }; if let handler { RemoveEventHandler(handler) } }
}

// AppKit owns the window, Photos permissions, folder dialogs and Carbon hotkey.
// The compact settings surface is shared with the other platforms through WebKit.
final class SettingsWindow: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    private var window: NSWindow!
    private var web: WKWebView!
    private var settings: Settings
    private var error = ""
    private var ready = false
    private var readyActions: [() -> Void] = []
    private let changed: (Settings) -> String?
    private let page = Bundle.main.resourceURL!.appendingPathComponent("desktop/settings.html")
    private static let keys: [String: Int] = ["A":0,"S":1,"D":2,"F":3,"H":4,"G":5,"Z":6,"X":7,"C":8,"V":9,"B":11,"Q":12,"W":13,"E":14,"R":15,"Y":16,"T":17,"1":18,"2":19,"3":20,"4":21,"6":22,"5":23,"9":25,"7":26,"8":28,"0":29,"O":31,"U":32,"I":34,"P":35,"L":37,"J":38,"K":40,"N":45,"M":46,"Space":49,"F1":122,"F2":120,"F3":99,"F4":118,"F5":96,"F6":97,"F7":98,"F8":100,"F9":101,"F10":109,"F11":103,"F12":111,"F13":105,"F14":107,"F15":113,"F16":106,"F17":64,"F18":79,"F19":80,"F20":90]
    init(_ settings: Settings, changed: @escaping (Settings) -> String?) {
        self.settings = settings; self.changed = changed; super.init()
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent(); config.userContentController.add(self, name: "settings")
        web = WKWebView(frame: NSRect(x: 0, y: 0, width: 560, height: 292), configuration: config); web.navigationDelegate = self
        window = NSWindow(contentRect: web.frame, styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.title = "default_wallpaper"; window.isReleasedWhenClosed = false; window.contentView = web; window.center()
        web.loadFileURL(page, allowingReadAccessTo: Bundle.main.resourceURL!)
    }
    func show() {
        if CommandLine.arguments.contains("--preview-settings"), let screen=NSScreen.main { window.setFrameTopLeftPoint(NSPoint(x:32,y:screen.frame.maxY-32)) }
        window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
    }
    private func state() -> [String: Any] {
        let auth = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        window.setContentSize(NSSize(width: 560, height: 292 + (settings.photoSource == "folder" ? 22 : 0) + (error.isEmpty ? 0 : 44)))
        return ["platform": "darwin", "photoAccess": auth == .authorized || auth == .limited, "error": error,
                "settings": ["intervalMinutes": settings.intervalMinutes, "photoSource": settings.photoSource, "photoFolder": settings.photoFolder, "saveFolder": settings.saveFolder, "desktopButtons": settings.desktopButtons, "shortcut": settings.shortcutKey < 0 ? "" : settings.shortcutLabel]]
    }
    private func reply(_ id: Int, error: String? = nil) {
        if let error { self.error = error }
        web.callAsyncJavaScript("window.nativeReply(id,value,error)", arguments: ["id": id, "value": state(), "error": error as Any? ?? NSNull()], in: nil, in: .page) { _ in }
    }
    private func commit(_ next: Settings, id: Int) {
        if let message = changed(next) { reply(id, error: message); return }
        settings = next; error = ""; reply(id)
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.webView === web, web.url?.standardizedFileURL == page.standardizedFileURL,
              let body = message.body as? [String: Any], let id = (body["id"] as? NSNumber)?.intValue, let operation = body["operation"] as? String else { return }
        if CommandLine.arguments.contains("--preview-settings") { print("Settings IPC: \(operation)") }
        switch operation {
        case "state": reply(id)
        case "settings":
            guard let value = body["value"] as? [String: Any], let interval = value["intervalMinutes"] as? Int, Settings.intervals.contains(interval), let source = value["photoSource"] as? String, ["system", "folder", "none"].contains(source), let desktop = value["desktopButtons"] as? Bool, let shortcut = value["shortcut"] as? String else { reply(id, error: "Invalid settings"); return }
            var next = settings; next.intervalMinutes = interval; next.photoSource = source; next.desktopButtons = desktop
            if shortcut.isEmpty { next.shortcutKey = -1; next.shortcutModifiers = 0; next.shortcutLabel = "" }
            else {
                let parts = shortcut.split(separator: "+").map(String.init)
                guard let last = parts.last, let key = Self.keys[last], parts.count > 1, parts.dropLast().allSatisfy({ ["Control", "Alt", "Super", "Shift"].contains($0) }), parts.contains(where: { ["Control", "Alt", "Super"].contains($0) }) else { reply(id, error: "Use Control / Alt / Command + a key"); return }
                next.shortcutKey = key; next.shortcutLabel = shortcut
                next.shortcutModifiers = (parts.contains("Control") ? UInt32(controlKey) : 0) | (parts.contains("Alt") ? UInt32(optionKey) : 0) | (parts.contains("Super") ? UInt32(cmdKey) : 0) | (parts.contains("Shift") ? UInt32(shiftKey) : 0)
            }
            commit(next, id: id)
        case "choose":
            guard let kind = body["value"] as? String, ["photo", "save"].contains(kind) else { reply(id, error: "Unknown folder type"); return }
            let panel = NSOpenPanel(); panel.canChooseFiles = false; panel.canChooseDirectories = true; panel.canCreateDirectories = true; panel.allowsMultipleSelection = false
            panel.beginSheetModal(for: window) { [weak self] response in
                guard let self else { return }
                if response == .OK, let url = panel.url { var next = self.settings; if kind == "photo" { next.photoFolder = url.path; next.photoSource = "folder" } else { next.saveFolder = url.path }; self.commit(next, id: id) }
                else { self.reply(id) }
            }
        case "connect":
            PhotoSource.requestAccess { [weak self] allowed in self?.error = allowed ? "" : "Photos access denied"; self?.reply(id) }
        default: reply(id, error: "Unknown action")
        }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(navigationAction.request.url?.standardizedFileURL == page.standardizedFileURL ? .allow : .cancel)
    }
    func whenReady(_ action: @escaping () -> Void) {
        if ready { action() } else { readyActions.append(action) }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        ready = true; let actions = readyActions; readyActions = []; actions.forEach { $0() }
    }
    func verifyUI(completion: @escaping (Bool) -> Void) {
        let script = """
        await document.fonts.ready;
        for(let i=0;i<100&&!window.wallpapers;i++)await new Promise(r=>setTimeout(r,20));
        const initial=await wallpapers.state();
        await wallpapers.update({...initial.settings,intervalMinutes:15,desktopButtons:true,shortcut:'Control+Alt+G'});
        const value=await wallpapers.state();
        const valid=value.settings.intervalMinutes===15&&value.settings.desktopButtons&&value.settings.shortcut==='Control+Alt+G';
        await wallpapers.update({...initial.settings});return valid;
        """
        web.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { result in
            switch result {
            case .success(let value): completion((value as? Bool) == true)
            case .failure(let error): print("Native settings verification:", error); completion(false)
            }
        }
    }
    func capture(to url: URL, completion: @escaping (Bool) -> Void) {
        web.callAsyncJavaScript("await document.fonts.ready;return !!document.querySelector('.selector-face');", arguments: [:], in: nil, in: .page) { [weak self] _ in
            self?.web.takeSnapshot(with: nil) { image, _ in
                guard let image, let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let data = rep.representation(using: .png, properties: [:]) else { completion(false); return }
                do { try data.write(to: url); completion(true) } catch { completion(false) }
            }
        }
    }
}
