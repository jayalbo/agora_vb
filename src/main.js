import AgoraRTC from "agora-rtc-sdk-ng";
import VirtualBackgroundExtension from "agora-extension-virtual-background";

const ui = {
  previewFit: document.getElementById("preview-fit"),
  vbBackgroundFit: document.getElementById("vb-background-fit"),
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

/** @type {(el: HTMLSelectElement) => "cover" | "contain" | "fill"} */
function readFitSelect(el) {
  const v = el.value;
  if (v === "contain" || v === "fill") return v;
  return "cover";
}

function getPreviewFit() {
  return readFitSelect(ui.previewFit);
}

function getVbBackgroundFit() {
  return readFitSelect(ui.vbBackgroundFit);
}

function playLocalPreview() {
  if (!localVideoTrack) return;
  localVideoTrack.play("local-player", { fit: getPreviewFit() });
}

/** Last VB effect so we can change background fit without re-picking blur/image. */
let vbEffect = /** @type {{ kind: "none" } | { kind: "blur"; blurDegree: number } | { kind: "img"; source: HTMLImageElement }} */ (
  { kind: "none" }
);

async function reapplyVbEffectOptions() {
  if (!processor || !processorEnabled) return;
  if (vbEffect.kind === "blur") {
    await processor.setOptions({
      type: "blur",
      blurDegree: vbEffect.blurDegree,
      fit: getVbBackgroundFit()
    });
  } else if (vbEffect.kind === "img") {
    await processor.setOptions({
      type: "img",
      source: vbEffect.source,
      fit: getVbBackgroundFit()
    });
  }
}

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
    playLocalPreview();

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
    vbEffect = { kind: "blur", blurDegree: 2 };
    await processor.setOptions({
      type: "blur",
      blurDegree: 2,
      fit: getVbBackgroundFit()
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
    vbEffect = { kind: "img", source: image };
    await processor.setOptions({
      type: "img",
      source: image,
      fit: getVbBackgroundFit()
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
    vbEffect = { kind: "none" };
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
    vbEffect = { kind: "none" };
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

ui.previewFit.addEventListener("change", () => {
  playLocalPreview();
  if (localVideoTrack) {
    log(`Preview fit: ${getPreviewFit()}`);
  }
});

ui.vbBackgroundFit.addEventListener("change", async () => {
  try {
    await reapplyVbEffectOptions();
    if (processorEnabled && (vbEffect.kind === "blur" || vbEffect.kind === "img")) {
      log(`VB background fit: ${getVbBackgroundFit()}`);
    }
  } catch (err) {
    log(`Failed to update VB background fit: ${err.message || err}`);
  }
});

setState();
log("Ready. Click Start Camera to begin.");
