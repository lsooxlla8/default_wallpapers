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
if let i = arguments.firstIndex(of: "--simulate-screens"), arguments.count > i+2 {
    let sizes = arguments[i+1].split(separator: ",").compactMap { s -> NSSize? in let p = s.split(separator: "x"); return p.count == 2 ? NSSize(width: Double(p[0])!, height: Double(p[1])!) : nil }
    let out = URL(fileURLWithPath: arguments[i+2], isDirectory: true)
    try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
    let renderer = Renderer(), base = UInt32(arguments.count > i+3 ? UInt32(arguments[i+3]) ?? 7 : 7)
    let list = sizes.enumerated().map { ["id": "sim\($0.offset)", "w": Int($0.element.width), "h": Int($0.element.height), "seed": Int(seedFor(base: base, id: "sim\($0.offset)"))] as [String:Any] }
    renderer.run(generationScript, arguments: ["targets": list, "palette": [], "photos": []]) { result in
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
