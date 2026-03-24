import AgoraRTC from "agora-rtc-sdk-ng";
import VirtualBackgroundExtension from "agora-extension-virtual-background";

const ui = {
  startCamera: document.getElementById("start-camera"),
  applyBlur: document.getElementById("apply-blur"),
  applyImage: document.getElementById("apply-image"),
  clearEffect: document.getElementById("clear-effect"),
  stopProcessor: document.getElementById("stop-processor"),
  resumeProcessor: document.getElementById("resume-processor"),
  stopCamera: document.getElementById("stop-camera"),
  processorState: document.getElementById("processor-state"),
  vbCost: document.getElementById("vb-cost"),
  logs: document.getElementById("logs")
};

const extension = new VirtualBackgroundExtension();
AgoraRTC.registerExtensions([extension]);

let localVideoTrack = null;
let processor = null;
let piped = false;
let processorEnabled = false;

function log(message) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  ui.logs.textContent = `${line}\n${ui.logs.textContent}`;
}

function setState() {
  ui.applyBlur.disabled = !localVideoTrack;
  ui.applyImage.disabled = !localVideoTrack;
  ui.clearEffect.disabled = !localVideoTrack;
  ui.stopProcessor.disabled = !localVideoTrack || !processorEnabled;
  ui.resumeProcessor.disabled = !localVideoTrack || processorEnabled;
  ui.stopCamera.disabled = !localVideoTrack;

  ui.processorState.textContent = localVideoTrack
    ? processorEnabled
      ? "running"
      : "stopped"
    : "idle";
}

async function ensureProcessorReady() {
  if (!processor) {
    if (!extension.checkCompatibility()) {
      throw new Error("Virtual Background is not supported in this browser.");
    }

    processor = extension.createProcessor();
    await processor.init();

    processor.eventBus.on("cost", (cost) => {
      console.warn(`cost of vb is ${cost}`);
      ui.vbCost.textContent = String(cost);
      log(`VB cost event: ${cost}`);
    });
  }

  if (localVideoTrack && !piped) {
    localVideoTrack.pipe(processor).pipe(localVideoTrack.processorDestination);
    piped = true;
  }
}

async function ensureProcessorEnabled() {
  await ensureProcessorReady();
  if (!processorEnabled) {
    await processor.enable();
    processorEnabled = true;
    log("Processor enabled");
    setState();
  }
}

ui.startCamera.addEventListener("click", async () => {
  try {
    if (localVideoTrack) {
      log("Camera already started");
      return;
    }

    localVideoTrack = await AgoraRTC.createCameraVideoTrack();
    localVideoTrack.play("local-player");

    await ensureProcessorReady();
    setState();
    log("Camera started");
  } catch (err) {
    log(`Failed to start camera: ${err.message || err}`);
  }
});

ui.applyBlur.addEventListener("click", async () => {
  try {
    if (!localVideoTrack) return;
    await ensureProcessorEnabled();
    await processor.setOptions({
      type: "blur",
      blurDegree: 2
    });
    log("Blur effect applied");
  } catch (err) {
    log(`Failed to apply blur: ${err.message || err}`);
  }
});

ui.applyImage.addEventListener("click", async () => {
  try {
    if (!localVideoTrack) return;
    await ensureProcessorEnabled();
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src =
      "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1280&q=80";
    await image.decode();
    await processor.setOptions({
      type: "img",
      source: image
    });
    log("Image background effect applied");
  } catch (err) {
    log(`Failed to apply image background: ${err.message || err}`);
  }
});

ui.clearEffect.addEventListener("click", async () => {
  try {
    if (!localVideoTrack) return;
    await ensureProcessorEnabled();
    await processor.setOptions({ type: "none" });
    log("Effect cleared");
  } catch (err) {
    log(`Failed to clear effect: ${err.message || err}`);
  }
});

ui.stopProcessor.addEventListener("click", async () => {
  try {
    if (!processor || !processorEnabled) return;
    await processor.disable();
    processorEnabled = false;
    ui.vbCost.textContent = "0";
    setState();
    log("Processor stopped");
  } catch (err) {
    log(`Failed to stop processor: ${err.message || err}`);
  }
});

ui.resumeProcessor.addEventListener("click", async () => {
  try {
    if (!localVideoTrack) return;
    await ensureProcessorEnabled();
  } catch (err) {
    log(`Failed to resume processor: ${err.message || err}`);
  }
});

ui.stopCamera.addEventListener("click", async () => {
  try {
    if (!localVideoTrack) return;

    if (processorEnabled && processor) {
      await processor.disable();
    }

    if (piped) {
      localVideoTrack.unpipe();
      piped = false;
    }

    localVideoTrack.stop();
    localVideoTrack.close();
    localVideoTrack = null;
    processorEnabled = false;
    ui.vbCost.textContent = "0";

    if (processor) {
      await processor.release();
      processor = null;
    }

    const player = document.getElementById("local-player");
    player.innerHTML = "";

    setState();
    log("Camera stopped");
  } catch (err) {
    log(`Failed to stop camera: ${err.message || err}`);
  }
});

setState();
log("Ready. Click Start Camera to begin.");
