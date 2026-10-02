/**
 * Prusa Connect Client for Pebble Alloy
 * Communicates with PKJS over Pebble AppMessage to receive filtered printer updates
 * and send control signals like StopSignal.
 */
import Message from "pebble/message";

class PrusaConnect {
    #message;
    #listeners = [];
    #state = {
        progress: 0,
        fileName: "No file",
        printerName: "Prusa",
        completionTime: ""
    };

    constructor() {
        this.#message = new Message({
            keys: ["Progress", "FileName", "PrinterName", "CompletionTime", "StopSignal"],
            target: this,
            onReadable() {
                const target = this.target;
                const msg = this.read();

                let updated = false;

                if (msg.has("Progress")) {
                    target.#state.progress = msg.get("Progress");
                    updated = true;
                }
                if (msg.has("FileName")) {
                    target.#state.fileName = msg.get("FileName");
                    updated = true;
                }
                if (msg.has("PrinterName")) {
                    target.#state.printerName = msg.get("PrinterName");
                    updated = true;
                }
                if (msg.has("CompletionTime")) {
                    target.#state.completionTime = msg.get("CompletionTime");
                    updated = true;
                }

                if (updated) {
                    target.#notifyListeners();
                }
            }
        });
    }

    get state() {
        return this.#state;
    }

    addEventListener(callback) {
        this.#listeners.push(callback);
    }

    removeEventListener(callback) {
        this.#listeners = this.#listeners.filter(cb => cb !== callback);
    }

    #notifyListeners() {
        for (const listener of this.#listeners) {
            try {
                listener(this.#state);
            } catch (err) {
                console.log("Listener error: " + err);
            }
        }
    }

    /**
     * Sends StopSignal to PKJS to initiate stopping the current print
     */
    sendStopSignal() {
        console.log("Sending StopSignal to PKJS...");
        this.#message.write(new Map([["StopSignal", 1]]));
    }

    /**
     * Utility to format an ISO completion string into local clock time (e.g. "14:35")
     */
    static formatCompletionClock(isoString) {
        if (!isoString) return "--:--";
        try {
            const date = new Date(isoString);
            const hours = String(date.getHours()).padStart(2, "0");
            const mins = String(date.getMinutes()).padStart(2, "0");
            return `${hours}:${mins}`;
        } catch {
            return "--:--";
        }
    }

    close() {
        if (this.#message) {
            this.#message.close();
            this.#message = null;
        }
    }
}

export default PrusaConnect;
