// Gzowo Motion: turns the iPhone into a tracked motion controller for Gzowo games on the Mac.
import SwiftUI

@main
struct GzowoMotionApp: App {
    @StateObject private var link = Link()
    @StateObject private var tracker = Tracker()
    private let haptics = Haptics()

    var body: some Scene {
        WindowGroup {
            ContentView(haptics: haptics)
                .environmentObject(link)
                .environmentObject(tracker)
                .onAppear {
                    UIApplication.shared.isIdleTimerDisabled = true
                    let h = haptics
                    link.onHaptic = { i, s in h.play(i, s) }
                    tracker.link = link
                    link.start()
                    tracker.start()
                }
        }
    }
}
