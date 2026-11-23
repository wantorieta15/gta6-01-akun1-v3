# SOLMAR BAY — Sunset Run

[![make.fun competition](https://img.shields.io/badge/make.fun-gta6--01-orange)](https://make.fun/c/gta6-01)
[![rank](https://img.shields.io/badge/rank-aiming%20for%20top%2050-blue)](https://make.fun/c/gta6-01)
[![reward](https://img.shields.io/badge/reward-%241%2C666-green)](https://make.fun/c/gta6-01)

A 3D open-world crime game built for the [make.fun GTA 6 bounty](https://make.fun/c/gta6-01).
Drive, walk, fight and outrun the SBPD across Solmar Bay — a sun-soaked coastal
city of our own, with eight story missions, a three-person crew, five-star police
response, street races, stunt jumps and 20 golden geckos hidden around the map.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

WASD drive & walk · SPACE handbrake / drift · E enter / exit car · CLICK shoot ·
1–4 weapons · R reload · Z / X / C crew abilities · T radio · ESC map & pause.

## How it is built

- `game/index.html` — page, HUD, title screen and pause/map screen
- `game/src/main.js` — game loop, camera, driving, shooting, state machine
- `game/src/city.js` — the city: roads, towers, palms, beach, pier, sunset sky
- `game/src/vehicles.js` — cars, traffic AI, police cruisers, AIR-1 helicopter
- `game/src/actors.js` — the player on foot, pedestrians, rival gang members
- `game/src/police.js` — wanted level and SBPD dispatch
- `game/src/missions.js` — 8 story missions, stages, ratings
- `game/src/activities.js` — street race, stunt jumps, golden geckos
- `game/src/hud.js` — HUD, minimap, pause screen, saves
- `game/src/audio.js` — procedural WebAudio sound (engine, sirens, gunshots)
- `game/src/config.js` — city data, missions, crew, weapons, ranks, radio
- `game/src/shots.js` — deterministic screenshot presets
- `game/vendor/three.module.min.js` — vendored Three.js r160
- `main.ts` — builds `/output` with `dossier.json` for the judge

No network requests at runtime: every script, image and sound is a local file
or a `data:` URI. Three.js is vendored under `game/vendor/`.
