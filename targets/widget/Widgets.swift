import SwiftUI
import WidgetKit

@main
struct MomentsWidgets: WidgetBundle {
    var body: some Widget {
        MomentWidget()
        DaysTogetherWidget()
        StreakWidget()
    }
}

// MARK: - Their latest moment

struct MomentWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MomentWidget", provider: SnapshotProvider(loadsImage: true)) { entry in
            MomentWidgetView(entry: entry)
        }
        .configurationDisplayName("Their latest moment")
        .description("See their newest photo as soon as they share it.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}

struct MomentWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.widgetRenderingMode) private var renderingMode
    let entry: SnapshotEntry

    private var s: WidgetSnapshot { entry.snapshot ?? .preview }

    var body: some View {
        Group {
            if !entry.paired {
                ConnectPrompt().padding(16)
            } else if family == .systemMedium {
                medium
            } else if renderingMode == .accented {
                // Tinted / clear Home Screen: text over a photo would turn white on
                // white, so the photo sits in a card with the details beneath.
                VStack(alignment: .leading, spacing: 8) {
                    photo.clipShape(ContainerRelativeShape())
                    details(lines: 1)
                }
                .padding(11)
            } else {
                ZStack(alignment: .bottomLeading) {
                    photo
                    if entry.image != nil {
                        LinearGradient(colors: [.clear, .black.opacity(0.6)], startPoint: .center, endPoint: .bottom)
                    }
                    details(lines: family == .systemLarge ? 2 : 1)
                        .foregroundStyle(.white)
                        .padding(16)
                }
            }
        }
        .containerBackground(for: .widget) {
            if entry.paired && family != .systemMedium {
                LinearGradient(colors: [Color(hex: 0x6A2C5B), Color(hex: 0xFF4D6D), Color(hex: 0xFFAF7B)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            } else {
                Color.plainBackground
            }
        }
        .widgetURL(URL(string: "moments://home"))
    }

    /// Their photo, or (no photo yet / sample) a soft prompt on the gradient.
    @ViewBuilder private var photo: some View {
        if let image = entry.image {
            Image(uiImage: image)
                .resizable()
                .blendsWhenTinted()
                .scaledToFill()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipped()
                .accessibilityLabel("Photo from \(s.displayName)")
        } else {
            VStack(spacing: 6) {
                Image(systemName: entry.isSample ? "heart.fill" : "camera.fill").font(.title)
                if !entry.isSample {
                    Text("Nothing from \(s.displayName) yet").font(.caption.weight(.bold)).multilineTextAlignment(.center)
                }
            }
            .foregroundStyle(.white)
            .widgetAccentable()
            .padding(.bottom, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(renderingMode == .accented ? Color.white.opacity(0.15) : .clear)
        }
    }

    @ViewBuilder private func details(lines: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            if let caption = s.momentCaption {
                Text(caption).font(.subheadline.weight(.heavy)).lineLimit(lines)
            }
            HStack(spacing: 4) {
                Text(s.displayName).font(.caption.weight(.bold)).lineLimit(1)
                if let at = s.momentDate {
                    Text("·").font(.caption)
                    // The system keeps relative times current between refreshes.
                    Text(at, style: .relative).font(.caption).lineLimit(1)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Medium: photo on the left, what they shared and how they feel on the right.
    private var medium: some View {
        HStack(spacing: 14) {
            ZStack {
                LinearGradient(colors: [Color(hex: 0x6A2C5B), Color(hex: 0xFF4D6D), Color(hex: 0xFFAF7B)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                photo
            }
            .aspectRatio(1, contentMode: .fit)
            .clipShape(ContainerRelativeShape())

            VStack(alignment: .leading, spacing: 4) {
                Text(s.displayName).font(.caption.weight(.bold)).foregroundStyle(Color.inkSecondary)
                Text(s.momentCaption ?? (entry.image == nil ? "No moment yet" : "New moment"))
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(Color.ink)
                    .lineLimit(2)
                if let at = s.momentDate {
                    Text(at, style: .relative).font(.caption).foregroundStyle(Color.inkSecondary).lineLimit(1)
                }
                Spacer(minLength: 0)
                if let emoji = s.partnerMoodEmoji, let label = s.partnerMoodLabel {
                    HStack(spacing: 4) {
                        Text(emoji).font(.subheadline)
                        Text("Feeling \(label.lowercased())").font(.caption.weight(.semibold)).foregroundStyle(Color.ink)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
        .padding(11)
    }
}

// MARK: - Days together

struct DaysTogetherWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "DaysTogetherWidget", provider: SnapshotProvider()) { entry in
            DaysTogetherView(entry: entry)
        }
        .configurationDisplayName("Days together")
        .description("Count every day you’ve shared, on your Home Screen or Lock Screen.")
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

struct DaysTogetherView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SnapshotEntry

    var body: some View {
        let days = entry.snapshot?.days(at: entry.date) ?? 0
        Group {
            if !entry.paired {
                if family == .systemSmall { ConnectPrompt() } else { AccessoryConnectPrompt() }
            } else {
                switch family {
                case .accessoryCircular:
                    ZStack {
                        AccessoryWidgetBackground()
                        VStack(spacing: -2) {
                            Text("\(days)").font(.title3.weight(.heavy)).minimumScaleFactor(0.5).numberTransition()
                            Text("days").font(.caption2.weight(.semibold))
                        }
                        .padding(.horizontal, 4)
                    }
                    .accessibilityLabel("\(days) days together")
                case .accessoryRectangular:
                    VStack(alignment: .leading, spacing: 0) {
                        Label("Together", systemImage: "heart.fill").font(.caption.weight(.semibold))
                        Text("\(days) days").font(.title3.weight(.heavy)).numberTransition().widgetAccentable()
                        if let name = entry.snapshot?.partnerName, !name.isEmpty {
                            Text("with \(name)").font(.caption)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                case .accessoryInline:
                    Label("\(days) days together", systemImage: "heart.fill")
                default:
                    VStack(alignment: .leading, spacing: 0) {
                        Image(systemName: "heart.fill").font(.title3).foregroundStyle(Color.coral).widgetAccentable()
                        Spacer(minLength: 0)
                        Text("\(days)")
                            .font(.system(size: 44, weight: .black, design: .rounded))
                            .minimumScaleFactor(0.5)
                            .lineLimit(1)
                            .foregroundStyle(Color.ink)
                            .numberTransition()
                            .widgetAccentable()
                        Text(days == 1 ? "day together" : "days together")
                            .font(.subheadline.weight(.heavy))
                            .foregroundStyle(Color.ink)
                        if let name = entry.snapshot?.partnerName, !name.isEmpty {
                            Text("with \(name)").font(.caption.weight(.semibold)).foregroundStyle(Color.inkSecondary).lineLimit(1)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .containerBackground(for: .widget) { Color.lilacBackground }
        .widgetURL(URL(string: "moments://profile"))
    }
}

// MARK: - Streak

struct StreakWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "StreakWidget", provider: SnapshotProvider()) { entry in
            StreakView(entry: entry)
        }
        .configurationDisplayName("Streak")
        .description("Keep your streak alive and see if today’s already safe.")
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular])
    }
}

struct StreakView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SnapshotEntry

    var body: some View {
        let streak = entry.snapshot?.streak ?? 0
        let safe = entry.snapshot?.streakSafeToday == true
        Group {
            if !entry.paired {
                if family == .systemSmall { ConnectPrompt() } else { AccessoryConnectPrompt() }
            } else {
                switch family {
                case .accessoryCircular:
                    ZStack {
                        AccessoryWidgetBackground()
                        VStack(spacing: -1) {
                            // Filled once today is safe, outlined while it still needs you.
                            Image(systemName: safe ? "flame.fill" : "flame").font(.body)
                            Text("\(streak)").font(.title3.weight(.heavy)).minimumScaleFactor(0.5).numberTransition()
                        }
                        .padding(.horizontal, 4)
                    }
                    .accessibilityLabel("\(streak) day streak, \(safe ? "today is safe" : "show up today")")
                case .accessoryRectangular:
                    VStack(alignment: .leading, spacing: 0) {
                        Label("Streak", systemImage: safe ? "flame.fill" : "flame").font(.caption.weight(.semibold))
                        Text("\(streak) days").font(.title3.weight(.heavy)).numberTransition().widgetAccentable()
                        Text(safe ? "Today’s safe" : "Show up together today").font(.caption)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                default:
                    VStack(alignment: .leading, spacing: 0) {
                        Image(systemName: "flame.fill").font(.title3).foregroundStyle(Color.flame).widgetAccentable()
                        Spacer(minLength: 0)
                        Text("\(streak)")
                            .font(.system(size: 44, weight: .black, design: .rounded))
                            .minimumScaleFactor(0.5)
                            .lineLimit(1)
                            .foregroundStyle(Color.ink)
                            .numberTransition()
                            .widgetAccentable()
                        Text("day streak")
                            .font(.subheadline.weight(.heavy))
                            .foregroundStyle(Color.ink)
                        // Words and an icon, not colour alone, carry the state.
                        Label(safe ? "Today’s safe" : "Show up today",
                              systemImage: safe ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(safe ? Color.inkSecondary : Color.flame)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .containerBackground(for: .widget) { Color.creamBackground }
        .widgetURL(URL(string: "moments://streak"))
    }
}
