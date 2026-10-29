import SwiftUI
import WidgetKit

@main
struct MomentsWidgets: WidgetBundle {
    var body: some Widget {
        MomentWidget()
        DaysTogetherWidget()
        StreakWidget()
        AnniversaryWidget()
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
        .description("Every day you’ve shared, and the next milestone coming up.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

struct DaysTogetherView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SnapshotEntry

    var body: some View {
        let s = entry.snapshot ?? .preview
        let days = s.days(at: entry.date)
        let milestone = s.nextMilestone(at: entry.date)
        Group {
            if !entry.paired {
                if family == .systemSmall || family == .systemMedium { ConnectPrompt() } else { AccessoryConnectPrompt() }
            } else {
                switch family {
                case .accessoryCircular:
                    Gauge(value: milestone.progress) {
                        Image(systemName: "heart.fill")
                    } currentValueLabel: {
                        Text("\(days)").minimumScaleFactor(0.5).numberTransition()
                    }
                    .gaugeStyle(.accessoryCircular)
                    .accessibilityLabel("\(days) days together")
                case .accessoryRectangular:
                    VStack(alignment: .leading, spacing: 1) {
                        Label("Together", systemImage: "heart.fill").font(.caption.weight(.semibold))
                        Text("\(days) days").font(.title3.weight(.heavy)).numberTransition().widgetAccentable()
                        Text("\(milestone.daysLeft) to \(milestone.label)").font(.caption)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                case .accessoryInline:
                    Label("\(days) days together", systemImage: "heart.fill")
                case .systemMedium:
                    medium(s, days: days, milestone: milestone)
                default:
                    small(days: days, milestone: milestone)
                }
            }
        }
        .containerBackground(for: .widget) { Color.lilacBackground }
        .widgetURL(URL(string: "moments://profile"))
    }

    private func small(days: Int, milestone: Milestone) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Sticker(name: "StickerHeart", width: 36)
            Spacer(minLength: 0)
            Text("\(days)")
                .font(.system(size: 42, weight: .black, design: .rounded))
                .minimumScaleFactor(0.5)
                .lineLimit(1)
                .foregroundStyle(Color.ink)
                .numberTransition()
                .widgetAccentable()
            Text(days == 1 ? "day together" : "days together")
                .font(.subheadline.weight(.heavy))
                .foregroundStyle(Color.ink)
            MilestoneBar(progress: milestone.progress, tint: .coral).padding(.top, 8)
            Text("\(milestone.daysLeft) to \(milestone.label)")
                .font(.caption2.weight(.bold))
                .foregroundStyle(Color.inkSecondary)
                .lineLimit(1)
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    /// Medium: the count with its sticker, then since when, the next milestone and the anniversary.
    private func medium(_ s: WidgetSnapshot, days: Int, milestone: Milestone) -> some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 0) {
                Sticker(name: "StickerHeart", width: 44)
                Spacer(minLength: 0)
                Text("\(days)")
                    .font(.system(size: 46, weight: .black, design: .rounded))
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                    .foregroundStyle(Color.ink)
                    .numberTransition()
                    .widgetAccentable()
                Text(days == 1 ? "day together" : "days together")
                    .font(.subheadline.weight(.heavy))
                    .foregroundStyle(Color.ink)
            }
            .frame(maxHeight: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("With \(s.displayName)").font(.subheadline.weight(.heavy)).foregroundStyle(Color.ink).lineLimit(1)
                    if let since = s.sinceDate {
                        Text("Since \(since.formatted(.dateTime.month(.abbreviated).day().year()))")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.inkSecondary)
                    }
                }
                VStack(alignment: .leading, spacing: 4) {
                    MilestoneBar(progress: milestone.progress, tint: .coral)
                    Text("\(milestone.daysLeft) days to \(milestone.label)")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Color.inkSecondary)
                        .lineLimit(1)
                }
                if let next = s.nextAnniversary(from: entry.date) {
                    Label(
                        next.daysLeft == 0 ? "Happy anniversary!" : "Anniversary in \(next.daysLeft) \(next.daysLeft == 1 ? "day" : "days")",
                        systemImage: "gift.fill"
                    )
                    .font(.caption.weight(.heavy))
                    .foregroundStyle(Color.coral)
                    .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
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
                    small(streak: streak, safe: safe)
                }
            }
        }
        .containerBackground(for: .widget) { Color.creamBackground }
        .widgetURL(URL(string: "moments://streak"))
    }

    /// The streak page's flame: lit with its face while the streak is alive, gone out at zero.
    private func small(streak: Int, safe: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                Sticker(name: streak > 0 ? "StickerFlame" : "StickerFlameOut", width: 38)
                Spacer(minLength: 0)
                // Words and an icon, not colour alone, carry the state.
                Image(systemName: safe ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                    .font(.title3)
                    .foregroundStyle(safe ? Color.inkSecondary : Color.flame)
                    .widgetAccentable()
            }
            Spacer(minLength: 0)
            Text("\(streak)")
                .font(.system(size: 42, weight: .black, design: .rounded))
                .minimumScaleFactor(0.5)
                .lineLimit(1)
                .foregroundStyle(Color.ink)
                .numberTransition()
                .widgetAccentable()
            Text("day streak")
                .font(.subheadline.weight(.heavy))
                .foregroundStyle(Color.ink)
            Text(streak == 0 ? "Start one today" : safe ? "Today’s safe" : "Show up today")
                .font(.caption.weight(.bold))
                .foregroundStyle(safe ? Color.inkSecondary : Color.flame)
                .lineLimit(1)
                .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Anniversary

struct AnniversaryWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AnniversaryWidget", provider: SnapshotProvider()) { entry in
            AnniversaryView(entry: entry)
        }
        .configurationDisplayName("Anniversary")
        .description("Count down to your next anniversary together.")
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

struct AnniversaryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: SnapshotEntry

    var body: some View {
        let next = (entry.snapshot ?? .preview).nextAnniversary(from: entry.date)
        Group {
            if !entry.paired {
                if family == .systemSmall { ConnectPrompt() } else { AccessoryConnectPrompt() }
            } else if let next {
                switch family {
                case .accessoryCircular:
                    Gauge(value: next.progress) {
                        Image(systemName: "heart.fill")
                    } currentValueLabel: {
                        Text("\(next.daysLeft)").minimumScaleFactor(0.5)
                    }
                    .gaugeStyle(.accessoryCircular)
                    .accessibilityLabel(next.daysLeft == 0 ? "Your anniversary is today" : "\(next.daysLeft) days to your anniversary")
                case .accessoryRectangular:
                    VStack(alignment: .leading, spacing: 0) {
                        Label("Anniversary", systemImage: "heart.fill").font(.caption.weight(.semibold))
                        Text(next.daysLeft == 0 ? "Today!" : "\(next.daysLeft) days")
                            .font(.title3.weight(.heavy)).widgetAccentable()
                        Text("Your \(next.ordinal) · \(next.date.formatted(.dateTime.month(.abbreviated).day()))").font(.caption)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                case .accessoryInline:
                    Label(next.daysLeft == 0 ? "Happy anniversary" : "\(next.daysLeft) days to your anniversary", systemImage: "heart.fill")
                default:
                    small(next)
                }
            } else {
                // Paired, but no anniversary set yet.
                VStack(alignment: .leading, spacing: 6) {
                    Sticker(name: "StickerHeart", width: 34)
                    Spacer(minLength: 0)
                    Text("Add your anniversary").font(.headline.weight(.heavy)).foregroundStyle(Color.ink)
                    Text("Set it in Moments to count down").font(.caption.weight(.semibold)).foregroundStyle(Color.inkSecondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            }
        }
        .containerBackground(for: .widget) { Color.blushBackground }
        .widgetURL(URL(string: "moments://profile"))
    }

    /// The year so far as a ring around the sticker heart, then the days left and which anniversary.
    private func small(_ next: Anniversary) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: 10) {
                ZStack {
                    Circle().stroke(Color.track, lineWidth: 6)
                    Circle()
                        .trim(from: 0, to: next.daysLeft == 0 ? 1 : next.progress)
                        .stroke(Color.coral, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .widgetAccentable()
                    Sticker(name: "StickerHeart", width: 26)
                }
                .frame(width: 54, height: 54)
                Text("Anniversary")
                    .font(.caption.weight(.heavy))
                    .foregroundStyle(Color.rose)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            Spacer(minLength: 0)
            if next.daysLeft == 0 {
                Text("Happy anniversary!")
                    .font(.system(size: 22, weight: .black, design: .rounded))
                    .foregroundStyle(Color.ink)
                    .minimumScaleFactor(0.6)
                    .lineLimit(2)
            } else {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("\(next.daysLeft)")
                        .font(.system(size: 40, weight: .black, design: .rounded))
                        .foregroundStyle(Color.ink)
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                        .widgetAccentable()
                    Text(next.daysLeft == 1 ? "day" : "days")
                        .font(.subheadline.weight(.heavy))
                        .foregroundStyle(Color.ink)
                }
            }
            Text("Your \(next.ordinal) · \(next.date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()))")
                .font(.caption.weight(.bold))
                .foregroundStyle(Color.inkSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}
