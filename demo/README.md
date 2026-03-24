# Agora Virtual Background Demo

Simple customer-facing demo for local camera preview with Agora Virtual Background.

## Features

- Start local camera
- Apply blur background
- Apply image background
- Clear effect
- Stop / resume virtual background processor
- Show cost events from the processor event bus

## Setup

1. Install dependencies:

```bash
cd demo
npm install
```

2. Run locally:

```bash
npm run dev
```

3. Open the URL shown by Vite (usually `http://localhost:5173`).

## Notes

- This demo uses local preview only (no channel join needed).
- Browser will ask for camera permission.
- Cost display uses:

```js
processor.eventBus.on("cost", (cost) => {
  console.warn(`cost of vb is ${cost}`);
});
```
