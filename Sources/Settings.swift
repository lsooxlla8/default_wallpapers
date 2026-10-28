import AppKit
import Carbon

struct Settings: Codable {
    var intervalMinutes: Int = 60
    var photoSource: String = "system"
    var photoFolder: String = ""
    var saveFolder: String = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Documents/Wallpaper Generator").path
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

final class SettingsWindow: NSObject, NSWindowDelegate {
    private var window: NSWindow!
    private let frequency = NSPopUpButton()
    private let source = NSPopUpButton()
    private let photoPath = NSTextField(labelWithString: "")
    private let savePath = NSTextField(labelWithString: "")
    private let status = NSTextField(wrappingLabelWithString: "")
    private let buttons = NSButton(checkboxWithTitle: "Показывать кнопки на рабочем столе", target: nil, action: nil)
    private let shortcut = NSButton(title: "Назначить…", target: nil, action: nil)
    private var monitor: Any?
    private var settings: Settings
    private let changed: (Settings) -> String?
    init(_ settings: Settings, changed: @escaping (Settings) -> String?) {
        self.settings = settings; self.changed = changed
        super.init()
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 520, height: 510), styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.title = "Wallpaper Generator — Настройки"; window.isReleasedWhenClosed = false; window.delegate = self
        let root = NSStackView(); root.orientation = .vertical; root.alignment = .leading; root.spacing = 8
        root.translatesAutoresizingMaskIntoConstraints = false; window.contentView!.addSubview(root)
        NSLayoutConstraint.activate([root.leadingAnchor.constraint(equalTo: window.contentView!.leadingAnchor, constant: 24), root.trailingAnchor.constraint(equalTo: window.contentView!.trailingAnchor, constant: -24), root.topAnchor.constraint(equalTo: window.contentView!.topAnchor, constant: 24)])
        func row(_ label: String, _ controls: [NSView]) {
            let title = NSTextField(labelWithString: label); title.font = .boldSystemFont(ofSize: 13)
            root.addArrangedSubview(title)
            let line = NSStackView(views: controls); line.orientation = .horizontal; line.spacing = 8; root.addArrangedSubview(line)
        }
        frequency.addItems(withTitles: ["Только вручную", "Каждую минуту", "Каждые 5 минут", "Каждые 15 минут", "Каждые 30 минут", "Каждый час", "Каждые 2 часа", "Каждые 6 часов", "Каждые 12 часов", "Каждый день"])
        frequency.selectItem(at: Settings.intervals.firstIndex(of: settings.intervalMinutes) ?? 5); frequency.target = self; frequency.action = #selector(edit)
        row("Смена обоев", [frequency])
        source.addItems(withTitles: ["Системная фототека", "Выбранная папка", "Без фотографий"])
        source.selectItem(at: ["system", "folder", "none"].firstIndex(of: settings.photoSource) ?? 0); source.target = self; source.action = #selector(edit)
        let choosePhotos = NSButton(title: "Выбрать папку…", target: self, action: #selector(choosePhotoFolder))
        row("Источник фотографий", [source, choosePhotos]); root.addArrangedSubview(NSButton(title: "Разрешить доступ к Фото…", target: self, action: #selector(connectPhotos))); photoPath.lineBreakMode = .byTruncatingMiddle; root.addArrangedSubview(photoPath)
        let chooseSave = NSButton(title: "Выбрать папку…", target: self, action: #selector(chooseSaveFolder))
        row("Сохранять работы в", [chooseSave, savePath]); savePath.lineBreakMode = .byTruncatingMiddle
        buttons.state = settings.desktopButtons ? .on : .off; buttons.target = self; buttons.action = #selector(edit); root.addArrangedSubview(buttons)
        shortcut.target = self; shortcut.action = #selector(recordShortcut)
        row("Шорткат генерации", [shortcut, NSButton(title: "Отключить", target: self, action: #selector(clearShortcut))])
        status.font = .systemFont(ofSize: 11); root.addArrangedSubview(status)
        updateLabels(); window.center()
    }
    func show() { window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true) }
    private func updateLabels() {
        photoPath.stringValue = settings.photoSource == "folder" ? (settings.photoFolder.isEmpty ? "Папка не выбрана" : settings.photoFolder) : (settings.photoSource == "system" ? "Доступ к Фото запрашивается только после выбора этого источника." : "Только процедурная графика")
        savePath.stringValue = settings.saveFolder
        shortcut.title = settings.shortcutKey < 0 ? "Назначить…" : settings.shortcutLabel
    }
    private func persist() { status.stringValue = changed(settings) ?? "Сохранено"; updateLabels() }
    @objc private func connectPhotos() { PhotoSource.requestAccess { [weak self] allowed in self?.status.stringValue = allowed ? "Доступ к Фото разрешён" : "Нет доступа к Фото. Разрешите его в настройках macOS или выберите папку." } }
    @objc private func edit() {
        let previous = settings.photoSource
        settings.intervalMinutes = Settings.intervals[frequency.indexOfSelectedItem]
        settings.photoSource = ["system", "folder", "none"][source.indexOfSelectedItem]
        settings.desktopButtons = buttons.state == .on
        persist()
        if settings.photoSource == "system" && previous != "system" { PhotoSource.requestAccess { [weak self] allowed in self?.status.stringValue = allowed ? "Системная фототека подключена" : "Нет доступа к Фото. Разрешите его в настройках macOS или выберите папку." } }
    }
    private func chooseFolder(_ done: @escaping (URL) -> Void) {
        let panel = NSOpenPanel(); panel.canChooseFiles = false; panel.canChooseDirectories = true; panel.canCreateDirectories = true; panel.allowsMultipleSelection = false
        panel.beginSheetModal(for: window) { result in if result == .OK, let url = panel.url { done(url) } }
    }
    @objc private func choosePhotoFolder() { chooseFolder { [weak self] url in guard let self else { return }; self.settings.photoFolder = url.path; self.settings.photoSource = "folder"; self.source.selectItem(at: 1); self.persist() } }
    @objc private func chooseSaveFolder() { chooseFolder { [weak self] url in guard let self else { return }; self.settings.saveFolder = url.path; self.persist() } }
    @objc private func clearShortcut() { stopRecording(); settings.shortcutKey = -1; settings.shortcutModifiers = 0; settings.shortcutLabel = ""; persist() }
    private func stopRecording() { if let monitor { NSEvent.removeMonitor(monitor); self.monitor = nil }; updateLabels() }
    func windowWillClose(_ notification: Notification) { stopRecording() }
    @objc private func recordShortcut() {
        stopRecording(); shortcut.title = "Нажмите комбинацию… (Esc — отмена)"
        monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self else { return event }
            if event.keyCode == 53 { self.stopRecording(); return nil }
            let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
            guard !flags.intersection([.command, .control, .option]).isEmpty, let key = event.charactersIgnoringModifiers?.uppercased(), !key.isEmpty else { self.status.stringValue = "Добавьте ⌘, ⌃ или ⌥ к клавише"; return nil }
            self.settings.shortcutKey = Int(event.keyCode)
            self.settings.shortcutModifiers = (flags.contains(.command) ? UInt32(cmdKey) : 0) | (flags.contains(.control) ? UInt32(controlKey) : 0) | (flags.contains(.option) ? UInt32(optionKey) : 0) | (flags.contains(.shift) ? UInt32(shiftKey) : 0)
            self.settings.shortcutLabel = (flags.contains(.control) ? "⌃" : "") + (flags.contains(.option) ? "⌥" : "") + (flags.contains(.shift) ? "⇧" : "") + (flags.contains(.command) ? "⌘" : "") + key
            self.stopRecording(); self.persist(); return nil
        }
    }
}
