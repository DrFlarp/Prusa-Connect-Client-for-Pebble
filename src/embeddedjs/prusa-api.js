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

    #isWritable = false;
    #pendingRefresh = false;

    constructor() {
        this.#message = new Message({
            keys: ["Progress", "FileName", "PrinterName", "CompletionTime", "StopSignal", "Configured", "Refresh", "RefreshToken", "Status"],
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
                if (msg.has("Configured")) {
                    target.#state.configured = msg.get("Configured");
                    updated = true;
                }
                if (msg.has("Status")) {
                    target.#state.status = msg.get("Status");
                    updated = true;
                }

                console.log("Watch received message: Configured=" + msg.get("Configured") + " Progress=" + msg.get("Progress") + " Status=" + msg.get("Status") + " File=" + msg.get("FileName"));
                if (updated) {
                    target.#notifyListeners();
                }
            },
            onWritable() {
                console.log("Message writable");
                this.target.#isWritable = true;
                if (this.target.#pendingRefresh) {
                    this.target.#pendingRefresh = false;
                    this.target.requestRefresh();
                }
            },
            onSuspend() {
                console.log("Message suspended");
                this.target.#isWritable = false;
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
        if (!this.#isWritable) {
            console.log("Message not writable, cannot send StopSignal");
            return;
        }
        console.log("Sending StopSignal to PKJS...");
        try {
            this.#message.write(new Map([["StopSignal", 1]]));
        } catch (e) {
            console.log("Error sending StopSignal: " + e);
        }
    }

    /**
     * Request an immediate status refresh from PKJS.
     */
    requestRefresh() {
        if (!this.#isWritable) {
            console.log("Message not writable yet, queuing Refresh signal...");
            this.#pendingRefresh = true;
            return;
        }
        console.log("Sending Refresh signal to PKJS...");
        try {
            this.#message.write(new Map([["Refresh", 1]]));
        } catch (e) {
            console.log("Error sending Refresh: " + e);
        }
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
