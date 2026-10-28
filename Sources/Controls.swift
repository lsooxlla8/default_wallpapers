import AppKit

final class DesktopPanel: NSPanel {
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}
// The existing default_desktop dice and floppy outlines, preserved at 32 px.
final class WallpaperIcon: NSButton {
    var isSave = false
    override func draw(_ dirtyRect: NSRect) {
        let ink = NSColor(calibratedWhite: 5.0/255, alpha: 1), paper = NSColor(calibratedWhite: 246.0/255, alpha: 1)
        (isHighlighted ? paper : ink).setFill(); bounds.fill()
        let foreground = (isHighlighted ? ink : paper).withAlphaComponent(isEnabled ? 1 : 0.32)
        foreground.setStroke(); foreground.setFill(); NSBezierPath(rect: bounds.insetBy(dx: 0.5, dy: 0.5)).stroke()
        let x = bounds.midX, y = bounds.midY
        if isSave {
            let p = NSBezierPath(); p.move(to: NSPoint(x: x-7, y: y-8)); p.line(to: NSPoint(x: x+7, y: y-8)); p.line(to: NSPoint(x: x+7, y: y+5)); p.line(to: NSPoint(x: x+4, y: y+8)); p.line(to: NSPoint(x: x-7, y: y+8)); p.close(); p.lineWidth = 1.2; p.stroke()
            NSBezierPath(rect: NSRect(x: x-4, y: y+2, width: 7, height: 5)).stroke()
            NSBezierPath(rect: NSRect(x: x-4, y: y-7, width: 8, height: 6)).stroke()
        } else {
            let p = NSBezierPath(rect: NSRect(x: x-7, y: y-7, width: 14, height: 14)); p.lineWidth = 1.2; p.stroke()
            for (dx,dy) in [(-3.5,-3.5),(3.5,-3.5),(0.0,0.0),(-3.5,3.5),(3.5,3.5)] { NSBezierPath(ovalIn: NSRect(x: x+dx-1, y: y+dy-1, width: 2, height: 2)).fill() }
        }
    }
}
final class DesktopControls {
    private var panel: DesktopPanel?
    private var buttons: [NSButton] = []
    func rebuild(show: Bool, target: AnyObject) {
        panel?.close(); panel = nil; buttons = []
        guard show, let screen = NSScreen.main ?? NSScreen.screens.first else { return }
        let root = NSView(frame: NSRect(x: 0, y: 0, width: 72, height: 32))
        for i in 0..<2 {
            let button = WallpaperIcon(frame: NSRect(x: i*40, y: 0, width: 32, height: 32))
            button.isSave = i == 1; button.title = ""; button.isBordered = false
            button.setAccessibilityLabel(i == 0 ? "Generate" : "Save sketch + PNG"); button.toolTip = i == 0 ? "Generate" : "Save sketch + PNG"
            button.target = target; button.action = i == 0 ? #selector(Generator.generateAll) : #selector(Generator.save)
            root.addSubview(button); buttons.append(button)
        }
        let p = DesktopPanel(contentRect: NSRect(x: screen.visibleFrame.minX+16, y: screen.visibleFrame.minY+16, width: 72, height: 32), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        p.isReleasedWhenClosed = false; p.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow))+2)
        p.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]; p.hidesOnDeactivate = false
        p.contentView = root; p.isOpaque = false; p.backgroundColor = .clear; p.hasShadow = false; p.orderFrontRegardless(); panel = p
    }
    func setEnabled(_ enabled: Bool) { buttons.forEach { $0.isEnabled = enabled; $0.needsDisplay = true } }
}
