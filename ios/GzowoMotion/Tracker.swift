// Gzowo Motion tracker: ARKit world tracking, streams the camera transform to the Mac every frame.
import ARKit
import AVFoundation

final class Tracker: NSObject, ObservableObject, ARSessionDelegate {
    @Published var quality = 0
    @Published var screenUp = false
    @Published var problem: String?
    weak var link: Link?

    private let session = ARSession()
    private let queue = DispatchQueue(label: "gzmotion.ar", qos: .userInteractive)
    private var lastQuality = -1
    private var lastScreenUp = false
    private var lastFrame = Date.distantPast

    func start() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .denied, .restricted:
            problem = "Brak dostępu do aparatu. Włącz go w Ustawieniach, bez niego telefon nie widzi ruchu."
            return
        default:
            problem = nil
        }
        session.delegate = self
        session.delegateQueue = queue
        let config = ARWorldTrackingConfiguration()
        config.worldAlignment = .gravity
        config.isLightEstimationEnabled = false
        session.run(config, options: [.resetTracking, .removeExistingAnchors])
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
            guard let self else { return }
            if Date().timeIntervalSince(self.lastFrame) > 3, self.problem == nil {
                if AVCaptureDevice.authorizationStatus(for: .video) != .authorized {
                    self.problem = "Brak dostępu do aparatu. Włącz go w Ustawieniach, bez niego telefon nie widzi ruchu."
                } else {
                    self.start()
                }
            }
        }
    }

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        let m = frame.camera.transform
        let q: Int
        switch frame.camera.trackingState {
        case .normal: q = 2
        case .limited: q = 1
        default: q = 0
        }
        let cols = [m.columns.0, m.columns.1, m.columns.2, m.columns.3]
        var s = "{\"t\":\"p\",\"s\":\(q),\"m\":["
        for (i, c) in cols.enumerated() {
            s += String(format: "%.5f,%.5f,%.5f,%.5f", c.x, c.y, c.z, c.w)
            if i < 3 { s += "," }
        }
        s += "]}"
        link?.send(s)
        lastFrame = Date()

        let up = m.columns.2.y > 0.85
        if q != lastQuality || up != lastScreenUp {
            lastQuality = q
            lastScreenUp = up
            DispatchQueue.main.async {
                self.quality = q
                self.screenUp = up
            }
        }
    }

    func session(_ session: ARSession, didFailWithError error: Error) {
        DispatchQueue.main.async {
            self.quality = 0
            if AVCaptureDevice.authorizationStatus(for: .video) != .authorized {
                self.problem = "Brak dostępu do aparatu. Włącz go w Ustawieniach, bez niego telefon nie widzi ruchu."
            } else {
                self.start()
            }
        }
    }

    func sessionWasInterrupted(_ session: ARSession) {
        DispatchQueue.main.async { self.quality = 0 }
    }

    func sessionInterruptionEnded(_ session: ARSession) {
        DispatchQueue.main.async { self.start() }
    }
}
