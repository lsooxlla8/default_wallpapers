import AppKit

final class DesktopPanel: NSPanel {
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}
final class DesktopControls {
    private var panel: DesktopPanel?
    private var buttons: [NSButton] = []
    func rebuild(show: Bool, target: AnyObject) {
        panel?.close(); panel = nil; buttons = []
        guard show, let screen = NSScreen.main ?? NSScreen.screens.first else { return }
        let root = NSView(frame: NSRect(x: 0, y: 0, width: 72, height: 32))
        for (i, symbol) in ["dice", "square.and.arrow.down"].enumerated() {
            let button = NSButton(frame: NSRect(x: i * 40, y: 0, width: 32, height: 32))
            button.image = NSImage(systemSymbolName: symbol, accessibilityDescription: i == 0 ? "Сгенерировать обои" : "Сохранить работу")
            button.title = ""; button.isBordered = false; button.contentTintColor = .white
            button.wantsLayer = true; button.layer?.backgroundColor = NSColor(calibratedWhite: 0.04, alpha: 0.88).cgColor
            button.target = target; button.action = i == 0 ? #selector(Generator.generateAll) : #selector(Generator.save)
            root.addSubview(button); buttons.append(button)
        }
        let p = DesktopPanel(contentRect: NSRect(x: screen.visibleFrame.minX + 16, y: screen.visibleFrame.minY + 16, width: 72, height: 32), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        p.isReleasedWhenClosed = false; p.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) + 2)
        p.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]; p.hidesOnDeactivate = false
        p.contentView = root; p.isOpaque = false; p.backgroundColor = .clear; p.hasShadow = false; p.orderFrontRegardless(); panel = p
    }
    func setEnabled(_ enabled: Bool) { buttons.forEach { $0.isEnabled = enabled } }
}
