# affordcraft.github.io

Source of the AffordCraft project page: **https://affordcraft.github.io/**

Code: https://github.com/AffordCraft/AffordCraft

A static site (no build step): `index.html`, `static/css`, `static/js` (three.js is vendored under `static/js/vendor`), and media under `static/`. Preview locally with

```bash
python -m http.server 8000
```

The library explorer reads `static/data/library.bin` (positions from a 3D t-SNE of the DINOv2 features used for retrieval, the joint type, source and label of each indexed library entry). The asset loops under `static/assets/` are Isaac Sim renders of assets built by AffordCraft from Open Images photographs.
