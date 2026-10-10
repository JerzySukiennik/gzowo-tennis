// Gzowo Motion link: finds a Mac game over Bonjour (_gzmotion._tcp), says hello and renders the screen the game sends.
import Foundation
import Network
import UIKit

struct ScreenButton: Identifiable, Hashable {
    let id: String
    let label: String
}

struct Screen: Equatable {
    var mode = "wait"
    var title = "Połączono"
    var subtitle = "Czekam na grę na Macu"
    var color = "#FF8A1F"
    var buttons: [ScreenButton] = []
}

final class Link: ObservableObject {
    @Published var status = "Szukam gry…"
    @Published var connected = false
    @Published var screen = Screen()
    var onHaptic: ((Float, Float) -> Void)?

    private let queue = DispatchQueue(label: "gzmotion.link", qos: .userInteractive)
    private var browser: NWBrowser?
    private var connection: NWConnection?
    private var buffer = Data()
    private var deviceName = "iPhone"

    let deviceId: String = {
        let key = "gzmotion.id"
        if let saved = UserDefaults.standard.string(forKey: key) { return saved }
        let fresh = UUID().uuidString
        UserDefaults.standard.set(fresh, forKey: key)
        return fresh
    }()

    func start() {
        let name = UIDevice.current.name.filter { $0 != "\"" && $0 != "\\" }
        queue.async {
            self.deviceName = name
            self.browse()
        }
    }

    func connectManual(_ host: String) {
        let trimmed = host.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, let port = NWEndpoint.Port(rawValue: 8793) else { return }
        queue.async {
            self.connection?.cancel()
            self.connection = nil
            self.connect(to: .hostPort(host: NWEndpoint.Host(trimmed), port: port))
        }
    }

    func send(_ text: String) {
        queue.async {
            guard let c = self.connection, c.state == .ready else { return }
            c.send(content: Data((text + "\n").utf8), completion: .idempotent)
        }
    }

    private func browse() {
        browser?.cancel()
        let b = NWBrowser(for: .bonjour(type: "_gzmotion._tcp", domain: nil), using: .tcp)
        b.browseResultsChangedHandler = { [weak self] results, _ in
            guard let self, self.connection == nil, let first = results.first else { return }
            self.connect(to: first.endpoint)
        }
        b.stateUpdateHandler = { [weak self] state in
            if case .failed = state { self?.retry() }
        }
        b.start(queue: queue)
        browser = b
    }

    private func connect(to endpoint: NWEndpoint) {
        let tcp = NWProtocolTCP.Options()
        tcp.noDelay = true
        let c = NWConnection(to: endpoint, using: NWParameters(tls: nil, tcp: tcp))
        connection = c
        publish(false, "Łączę z grą…")
        c.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            switch state {
            case .ready:
                c.send(content: Data("{\"t\":\"hello\",\"id\":\"\(self.deviceId)\",\"name\":\"\(self.deviceName)\"}\n".utf8), completion: .idempotent)
                self.publish(true, "Połączono")
                self.receive(on: c)
            case .waiting:
                c.cancel()
            case .failed, .cancelled:
                if self.connection === c {
                    self.connection = nil
                    self.buffer.removeAll()
                    self.publish(false, "Szukam gry…")
                    self.retry()
                }
            default:
                break
            }
        }
        c.start(queue: queue)
    }

    private func retry() {
        queue.asyncAfter(deadline: .now() + 1) { [weak self] in
            guard let self, self.connection == nil else { return }
            self.browse()
        }
    }

    private func publish(_ ok: Bool, _ text: String) {
        DispatchQueue.main.async {
            self.connected = ok
            self.status = text
            if !ok { self.screen = Screen() }
        }
    }

    private func receive(on c: NWConnection) {
        c.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, done, error in
            guard let self else { return }
            if let data {
                self.buffer.append(data)
                self.drain()
            }
            if done || error != nil {
                c.cancel()
                return
            }
            self.receive(on: c)
        }
    }

    private func drain() {
        while let nl = buffer.firstIndex(of: 10) {
            let line = Data(buffer[buffer.startIndex..<nl])
            buffer.removeSubrange(buffer.startIndex...nl)
            guard let obj = (try? JSONSerialization.jsonObject(with: line)) as? [String: Any],
                  let type = obj["t"] as? String else { continue }
            if type == "h" {
                let i = (obj["i"] as? Double) ?? 0.5
                let s = (obj["s"] as? Double) ?? 0.5
                onHaptic?(Float(i), Float(s))
            } else if type == "ui" {
                var next = Screen()
                next.mode = (obj["mode"] as? String) ?? "wait"
                next.title = (obj["title"] as? String) ?? ""
                next.subtitle = (obj["subtitle"] as? String) ?? ""
                next.color = (obj["color"] as? String) ?? "#FF8A1F"
                if let list = obj["buttons"] as? [[String: Any]] {
                    next.buttons = list.compactMap { b in
                        guard let id = b["id"] as? String, let label = b["label"] as? String else { return nil }
                        return ScreenButton(id: id, label: label)
                    }
                }
                DispatchQueue.main.async { self.screen = next }
            }
        }
    }
}
