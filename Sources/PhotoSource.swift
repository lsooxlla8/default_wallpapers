import AppKit
import Photos
import ImageIO

enum PhotoSource {
    static func requestAccess(_ done: @escaping (Bool) -> Void) {
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in DispatchQueue.main.async { done(status == .authorized || status == .limited) } }
    }
    static func sample(settings: Settings, completion: @escaping ([[String: String]], Error?) -> Void) {
        if settings.photoSource == "folder" {
            DispatchQueue.global(qos: .utility).async {
                let folder = URL(fileURLWithPath: settings.photoFolder)
                let files: [URL]
                do { files = try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.isRegularFileKey], options: [.skipsHiddenFiles]) }
                catch { DispatchQueue.main.async { completion([], error) }; return }
                // Random subset first: decode only a few local files, no iCloud download.
                let list = files.filter { ["jpg", "jpeg", "png", "heic", "webp", "tif", "tiff", "bmp"].contains($0.pathExtension.lowercased()) }.shuffled().prefix(4).compactMap { url -> [String: String]? in
                    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil), let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: 900, kCGImageSourceCreateThumbnailWithTransform: true] as CFDictionary), let jpeg = NSBitmapImageRep(cgImage: cg).representation(using: .jpeg, properties: [.compressionFactor: 0.82]) else { return nil }
                    return ["id": "local-" + UUID().uuidString, "url": "data:image/jpeg;base64," + jpeg.base64EncodedString()]
                }
                DispatchQueue.main.async { completion(list, nil) }
            }
            return
        }
        guard settings.photoSource == "system" else { completion([], nil); return }
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        guard status == .authorized || status == .limited else { completion([], nil); return }
        let options = PHFetchOptions(); options.predicate = NSPredicate(format: "mediaType == %d", PHAssetMediaType.image.rawValue)
        let all = PHAsset.fetchAssets(with: options)
        guard all.count > 0 else { completion([], nil); return }
        var indices = Set<Int>(); while indices.count < min(4, all.count) { indices.insert(Int.random(in: 0..<all.count)) }
        let request = PHImageRequestOptions(); request.isNetworkAccessAllowed = false; request.deliveryMode = .highQualityFormat; request.resizeMode = .fast
        var result: [[String: String]] = [], pending = indices.count, delivered = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 20) { if !delivered { delivered = true; completion(result, nil) } }
        for index in indices {
            let asset = all.object(at: index)
            var finished = false
            PHImageManager.default().requestImage(for: asset, targetSize: CGSize(width: 900, height: 900), contentMode: .aspectFit, options: request) { image, info in
                if (info?[PHImageResultIsDegradedKey] as? Bool) == true { return }
                DispatchQueue.main.async {
                    guard !finished && !delivered else { return }; finished = true
                    if let image, let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let jpeg = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.82]) { result.append(["id": asset.localIdentifier, "url": "data:image/jpeg;base64," + jpeg.base64EncodedString()]) }
                    pending -= 1; if pending == 0 { delivered = true; completion(result, nil) }
                }
            }
        }
    }
}
