// Gzowo Motion tracker: ARKit world tracking, streams the camera transform to the Mac every frame.
import ARKit

final class Tracker: NSObject, ObservableObject, ARSessionDelegate {
    @Published var quality = 0
    @Published var screenUp = false
    weak var link: Link?

    private let session = ARSession()
    private let queue = DispatchQueue(label: "gzmotion.ar", qos: .userInteractive)
    private var lastQuality = -1
    private var lastScreenUp = false

    func start() {
        session.delegate = self
        session.delegateQueue = queue
        let config = ARWorldTrackingConfiguration()
        config.worldAlignment = .gravity
        config.isLightEstimationEnabled = false
        session.run(config, options: [.resetTracking, .removeExistingAnchors])
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

    func sessionWasInterrupted(_ session: ARSession) {
        DispatchQueue.main.async { self.quality = 0 }
    }

    func sessionInterruptionEnded(_ session: ARSession) {
        start()
    }
}
