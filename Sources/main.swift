import AppKit

let arguments = CommandLine.arguments
if arguments.contains("--self-test") {
    precondition(Settings.intervals.contains(0) && Settings.intervals.contains(60))
    precondition(!Settings().desktopButtons && Settings().shortcutKey == -1)
    precondition(seedFor(base: 7, id: "a") != seedFor(base: 7, id: "b"))
    let data = try! JSONEncoder().encode(AnyCodable(["n": 3, "b": true, "a": [1, 2], "null": NSNull()]))
    let value = try! JSONDecoder().decode(AnyCodable.self, from: data).value as! [String: Any]
    precondition((value["b"] as? Bool) == true)
    precondition(photoIDs(["composition": [["photo": "one"], ["photo": "two"]]]) == Set(["one", "two"]))
    print("Native self-tests passed"); exit(0)
}
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
if let i = arguments.firstIndex(of: "--preview-settings"), arguments.count > i + 1 {
    let out = URL(fileURLWithPath: arguments[i + 1], isDirectory: true)
    try! FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
    DispatchQueue.main.asyncAfter(deadline: .now() + 30) { print("Settings verification timed out"); exit(1) }
    let preferences = SettingsWindow(Settings()) { _ in nil }; preferences.show()
    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
        preferences.verifyUI { valid in
            guard valid else { print("Native settings bridge failed"); exit(1) }
            preferences.capture(to: out.appendingPathComponent("settings-macos.png")) { success in exit(success ? 0 : 1) }
        }
    }
    app.run()
} else if let i = arguments.firstIndex(of: "--simulate-screens"), arguments.count > i + 2 {
    let sizes = arguments[i+1].split(separator: ",").compactMap { s -> NSSize? in
        let p = s.split(separator: "x"); guard p.count == 2, let w = Double(p[0]), let h = Double(p[1]), w > 0, h > 0, w <= 16384, h <= 16384 else { return nil }; return NSSize(width: w, height: h)
    }
    guard !sizes.isEmpty else { fputs("Invalid screen dimensions\n", stderr); exit(1) }
    let out = URL(fileURLWithPath: arguments[i+2], isDirectory: true)
    try! FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
    let renderer = Renderer(), base = UInt32(arguments.count > i+3 ? UInt32(arguments[i+3]) ?? 7 : 7)
    let list = sizes.enumerated().map { ["id": "sim\($0.offset)", "w": Int($0.element.width), "h": Int($0.element.height), "seed": Int(seedFor(base: base, id: "sim\($0.offset)"))] as [String: Any] }
    let photoData = try! Data(contentsOf: Bundle.main.resourceURL!.appendingPathComponent("fixture.png"))
    let photos = [["id": "fixture-photo", "url": "data:image/png;base64," + photoData.base64EncodedString()]]
    renderer.run(generationScript, arguments: ["targets": list, "palette": [], "photos": photos, "fixture": true]) { result in
        do {
            let frames = try result.get() as! [[String: Any]]
            var report: [[String: Any]] = []
            for (index, frame) in frames.enumerated() {
                let id = frame["id"] as! String, png = frame["png"] as! String
                let data = Data(base64Encoded: String(png.split(separator: ",", maxSplits: 1)[1]))!
                let rep = NSBitmapImageRep(data: data)!
                precondition(rep.pixelsWide == Int(sizes[index].width) && rep.pixelsHigh == Int(sizes[index].height))
                try data.write(to: out.appendingPathComponent("\(id).png"))
                let record = frame["record"] as! [String: Any]
                precondition(photoIDs(record).contains("fixture-photo"))
                try JSONSerialization.data(withJSONObject: record, options: [.prettyPrinted]).write(to: out.appendingPathComponent("\(id)-recipe.json"))
                report.append(["id": id, "seed": record["seed"] ?? 0, "palette": record["palette"] ?? [], "renderSize": record["renderSize"] ?? []])
            }
            let first = frames[0], record = first["record"] as! [String: Any]
            let folder = out.appendingPathComponent("photo-export", isDirectory: true)
            try exportWork(record: record, photos: photos, png: out.appendingPathComponent("sim0.png"), folder: folder)
            let width = Int(sizes[0].width), height = Int(sizes[0].height)
            let replay = "Art.setVisible(false);return {png:Art.stillFrame(\(width),\(height)).png,photos:DesktopExperiments.photos().length};"
            renderer.run(replay, arguments: [:], page: folder.appendingPathComponent("index.html")) { result in
                do {
                    let value = try result.get() as! [String: Any]
                    precondition((value["photos"] as? Int) == 1)
                    precondition((value["png"] as? String) == (first["png"] as? String), "Native photo export replay differs")
                    let summary: [String: Any] = ["screens": report, "photoExportExact": true, "desktopUnchanged": true]
                    try JSONSerialization.data(withJSONObject: summary, options: [.prettyPrinted]).write(to: out.appendingPathComponent("report.json"))
                    print("Native simulated displays and exact photo export passed"); exit(0)
                } catch { print(error); exit(1) }
            }
        } catch { print(error); exit(1) }
    }
    app.run()
} else {
    let generator = Generator(); generator.start(); app.run()
}
