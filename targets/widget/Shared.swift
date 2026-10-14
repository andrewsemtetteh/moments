import SwiftUI
import WidgetKit

/// Must match WIDGET_APP_GROUP in src/lib/widget-data.ts.
let appGroup = "group.com.vasemti.moments"

/// What the app shares with the widgets (see WidgetSnapshot in src/lib/widget-data.ts).
struct WidgetSnapshot: Codable {
    var partnerName: String
    var daysTogether: Int
    var since: String?
    var streak: Int
    var streakSafeToday: Bool
    var momentImageUrl: String?
    var momentCaption: String?
    var momentAt: String?
    var partnerMoodEmoji: String?
    var partnerMoodLabel: String?
    var paired: Bool
    var updatedAt: String?

    /// Realistic data for the widget gallery and placeholders.
    static let preview = WidgetSnapshot(
        partnerName: "Alex", daysTogether: 587, since: nil, streak: 42, streakSafeToday: true,
        momentImageUrl: nil, momentCaption: "Sunset walk", momentAt: nil,
        partnerMoodEmoji: "🥰", partnerMoodLabel: "Loved", paired: true, updatedAt: nil
    )

    static func load() -> WidgetSnapshot? {
        guard let json = UserDefaults(suiteName: appGroup)?.string(forKey: "snapshot"),
              let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    }

    private static func date(_ iso: String?) -> Date? {
        guard let iso else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }

    /// Days together as of `now`, so the count ticks over at midnight without the app.
    func days(at now: Date) -> Int {
        guard let start = Self.date(since) else { return daysTogether }
        let cal = Calendar.current
        return max(0, cal.dateComponents([.day], from: cal.startOfDay(for: start), to: cal.startOfDay(for: now)).day ?? daysTogether)
    }

    var momentDate: Date? { Self.date(momentAt) }
    var displayName: String { partnerName.isEmpty ? "Your person" : partnerName }
}

struct SnapshotEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
    /// Their latest photo, downloaded for the moment widget.
    var image: UIImage? = nil
    /// True only for the gallery / placeholder, which shows sample content.
    var isSample = false

    var paired: Bool { snapshot?.paired == true }
}

/// Their latest photo, kept in the App Group so the widget still shows it when
/// the network is slow or the signed link has expired.
enum MomentImageCache {
    private static var dir: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
    }
    private static func file(for key: String) -> URL? {
        let safe = key.unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) }.map(String.init).joined()
        return dir?.appendingPathComponent("widget-moment-\(safe.suffix(40)).jpg")
    }

    static func load(key: String) -> UIImage? {
        guard let url = file(for: key), let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }

    static func save(_ image: UIImage, key: String) {
        guard let dir, let url = file(for: key), let data = image.jpegData(compressionQuality: 0.85) else { return }
        // Only ever keep the newest photo.
        let old = (try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
        for f in old where f.lastPathComponent.hasPrefix("widget-moment-") { try? FileManager.default.removeItem(at: f) }
        try? data.write(to: url, options: .atomic)
    }
}

/// One provider for every widget. Refreshes when the app publishes new data
/// (it calls reloadAllTimelines), at midnight for the day count, and every 30 min.
struct SnapshotProvider: TimelineProvider {
    var loadsImage = false

    func placeholder(in context: Context) -> SnapshotEntry {
        SnapshotEntry(date: Date(), snapshot: .preview, isSample: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (SnapshotEntry) -> Void) {
        if context.isPreview || WidgetSnapshot.load() == nil {
            completion(SnapshotEntry(date: Date(), snapshot: .preview, isSample: true))
        } else {
            getTimeline(in: context) { completion($0.entries.first ?? placeholder(in: context)) }
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SnapshotEntry>) -> Void) {
        let now = Date()
        let snapshot = WidgetSnapshot.load()
        let midnight = Calendar.current.startOfDay(for: now.addingTimeInterval(86_400))
        let next = min(midnight, now.addingTimeInterval(30 * 60))

        func finish(_ image: UIImage?) {
            let entries = [SnapshotEntry(date: now, snapshot: snapshot, image: image),
                           SnapshotEntry(date: midnight, snapshot: snapshot, image: image)]
            completion(Timeline(entries: entries, policy: .after(next)))
        }

        guard loadsImage, let snapshot, let raw = snapshot.momentImageUrl, let url = URL(string: raw) else { return finish(nil) }
        let key = snapshot.momentAt ?? raw
        let cached = MomentImageCache.load(key: key)
        if let cached { return finish(cached) }

        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForResource = 15
        URLSession(configuration: config).dataTask(with: url) { data, _, _ in
            // Keep it small: widgets have a tight memory budget.
            let image = data.flatMap { UIImage(data: $0) }
                .map { $0.preparingThumbnail(of: CGSize(width: 800, height: 800)) ?? $0 }
            if let image { MomentImageCache.save(image, key: key) }
            finish(image)
        }.resume()
    }
}

// MARK: - Colors (light and dark, opaque so they hold up in every rendering mode)

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
                  blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    }
}

extension Color {
    init(hex: UInt32) { self.init(uiColor: UIColor(hex: hex)) }
    static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }

    static let ink = adaptive(0x1A1A1A, 0xF5F3FF)
    static let inkSecondary = adaptive(0x5E5A6E, 0xB9B4CC)
    static let coral = adaptive(0xFF4D6D, 0xFF6B85)
    static let flame = adaptive(0xF26A0A, 0xFF9A4A)
    static let lilacBackground = adaptive(0xE3DDFF, 0x262049)
    static let creamBackground = adaptive(0xFFF1D6, 0x33240F)
    static let plainBackground = adaptive(0xFFFFFF, 0x1C1C1E)
}

extension View {
    /// Numbers roll when they change, as Apple suggests for data updates.
    func numberTransition() -> some View { contentTransition(.numericText()) }
}

extension Image {
    /// In the tinted and clear Home Screen styles, blend the photo in rather
    /// than showing it in full colour (Apple reserves that for album art).
    @ViewBuilder func blendsWhenTinted() -> some View {
        if #available(iOS 18.0, *) {
            self.widgetAccentedRenderingMode(.accentedDesaturated)
        } else {
            self
        }
    }
}

/// Not signed in or not paired yet: say what to do, not just "open the app".
struct ConnectPrompt: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: "heart.fill").font(.title2).foregroundStyle(Color.coral).widgetAccentable()
            Spacer(minLength: 0)
            Text("Connect with your person")
                .font(.headline.weight(.heavy))
                .foregroundStyle(Color.ink)
            Text("Open Moments to get started")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.inkSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

/// Lock Screen version of the connect prompt.
struct AccessoryConnectPrompt: View {
    @Environment(\.widgetFamily) private var family
    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "heart.fill").font(.title3)
            }
        case .accessoryInline:
            Label("Open Moments to connect", systemImage: "heart.fill")
        default:
            VStack(alignment: .leading, spacing: 2) {
                Label("Moments", systemImage: "heart.fill").font(.headline.weight(.heavy))
                Text("Open the app to connect").font(.caption)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
