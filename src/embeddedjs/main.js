console.log("Hello, Pebble Alloy.");
import PrusaConnect from "./prusa-api";

const prusa = new PrusaConnect();

prusa.addEventListener((state) => {
    console.log("=== PRUSA UPDATE RECEIVED ===");
    console.log("Printer: " + state.printerName);
    console.log("Progress: " + state.progress + "%");
    console.log("File: " + state.fileName);
    console.log("Completion (ISO): " + state.completionTime);
    console.log("Est Finish: " + PrusaConnect.formatCompletionClock(state.completionTime));
});

// Example: Calling prusa.sendStopSignal() sends StopSignal to PKJS
// prusa.sendStopSignal();

export { prusa };