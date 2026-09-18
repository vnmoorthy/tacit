# Hand tracking model

`hand_landmarker.task` is Google's MediaPipe Hand Landmarker float16 model, version 1.

Source: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task

Documentation: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker

The model is served from this app's origin for reliable demonstrations without a runtime CDN dependency. The matching WASM runtime is bundled from the installed `@mediapipe/tasks-vision` npm package by Vite (`?url` imports); no duplicate runtime binaries are checked into this directory. Camera images are processed on the device and are not uploaded by the tracker.
