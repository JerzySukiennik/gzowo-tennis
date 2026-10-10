// Gzowo Motion UI: renders whatever screen the game sends (menu, pointer, play) on top of a touch-safe base.
import SwiftUI

struct ContentView: View {
    @EnvironmentObject var link: Link
    @EnvironmentObject var tracker: Tracker
    let haptics: Haptics

    @State private var ip = ""
    @State private var upSince: Date?
    @State private var upSent = false

    private let background = Color(red: 0.06, green: 0.065, blue: 0.09)

    var body: some View {
        ZStack {
            background.ignoresSafeArea()
            if !link.connected {
                searching
            } else {
                switch link.screen.mode {
                case "menu": menu
                case "pointer": pointer
                default: play
                }
            }
        }
        .animation(.easeInOut(duration: 0.2), value: link.screen)
        .preferredColorScheme(.dark)
        .onChange(of: tracker.screenUp) { _, up in
            if up {
                let since = Date()
                upSince = since
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                    if tracker.screenUp, upSince == since, !upSent {
                        upSent = true
                        link.send("{\"t\":\"screenUp\"}")
                        haptics.play(0.6, 0.3)
                    }
                }
            } else {
                upSince = nil
                upSent = false
            }
        }
    }

    private var accent: Color { Color(hex: link.screen.color) }

    private var trackingText: String {
        switch tracker.quality {
        case 2: return "Śledzenie OK"
        case 1: return "Rusz telefonem"
        default: return "Kamera startuje"
        }
    }

    private var statusRow: some View {
        HStack(spacing: 10) {
            Circle().fill(link.connected ? Color.green : Color.gray).frame(width: 10, height: 10)
            Text(link.status).font(.system(size: 15, weight: .semibold))
            Spacer()
            Text(trackingText).font(.system(size: 13, weight: .medium)).foregroundStyle(.secondary)
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
    }

    private var searching: some View {
        VStack(spacing: 20) {
            statusRow
            Spacer()
            ProgressView().scaleEffect(1.4)
            Text("Szukam gry na Macu")
                .font(.system(size: 26, weight: .bold, design: .rounded))
            Text("Telefon i Mac muszą być w tej samej sieci Wi-Fi.")
                .font(.system(size: 15))
                .foregroundStyle(.secondary)
            Spacer()
            HStack(spacing: 10) {
                TextField("IP Maca", text: $ip)
                    .keyboardType(.decimalPad)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(Color.white.opacity(0.08), in: Capsule())
                Button("Połącz") { link.connectManual(ip) }
                    .font(.system(size: 16, weight: .semibold))
            }
            .padding(24)
        }
    }

    private var header: some View {
        VStack(spacing: 10) {
            Text(link.screen.title)
                .font(.system(size: 34, weight: .heavy, design: .rounded))
                .multilineTextAlignment(.center)
            if !link.screen.subtitle.isEmpty {
                Text(link.screen.subtitle)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.horizontal, 28)
    }

    private var menu: some View {
        VStack(spacing: 18) {
            statusRow
            Spacer()
            header
            Spacer()
            ForEach(link.screen.buttons) { b in
                Button {
                    link.send("{\"t\":\"btn\",\"id\":\"\(b.id)\"}")
                    haptics.play(0.4, 0.6)
                } label: {
                    Text(b.label)
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 20)
                        .background(b.id == link.screen.buttons.first?.id ? accent : Color.white.opacity(0.1),
                                    in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                        .foregroundStyle(b.id == link.screen.buttons.first?.id ? Color.black : Color.white)
                }
                .padding(.horizontal, 24)
            }
            Spacer().frame(height: 20)
        }
    }

    private var pointer: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 36, style: .continuous)
                .fill(accent.opacity(0.16))
                .overlay(RoundedRectangle(cornerRadius: 36, style: .continuous).stroke(accent.opacity(0.6), lineWidth: 2))
                .padding(16)
            VStack(spacing: 18) {
                Image(systemName: "hand.point.up.left.fill")
                    .font(.system(size: 64, weight: .semibold))
                    .foregroundStyle(accent)
                header
                Text("Dotknij = kliknij · przytrzymaj = wyśrodkuj")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.secondary)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            link.send("{\"t\":\"tap\"}")
            haptics.play(0.5, 0.7)
        }
        .onLongPressGesture(minimumDuration: 0.5) {
            link.send("{\"t\":\"recenter\"}")
            haptics.play(0.8, 0.4)
        }
    }

    private var play: some View {
        VStack(spacing: 18) {
            Spacer()
            Circle()
                .fill(accent)
                .frame(width: 120, height: 120)
                .shadow(color: accent.opacity(0.6), radius: 30)
            header
            Spacer()
            Text("Połóż telefon ekranem do góry = pauza")
                .font(.system(size: 13))
                .foregroundStyle(.secondary)
                .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
        .onTapGesture {}
    }
}

extension Color {
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        let v = UInt64(s, radix: 16) ?? 0xFF8A1F
        self.init(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
    }
}
