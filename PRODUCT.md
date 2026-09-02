# Product

<!-- impeccable:product-schema 1 -->

## Platform

desktop

## Stack

Go (Wails v2 backend) + SQLite (modernc.org/sqlite) + React 18 + TypeScript + Tailwind CSS

## Users

Classic Doom players, speedrunners, and modders who launch source ports (GZDoom, PRBoom+, DSDA-Doom, Woof, Chocolate Doom, Crispy Doom) with base IWADs (DOOM, DOOM II, Final Doom, Heretic, Hexen, Strife) and load orders of custom mods (.wad, .pk3, .pk7, .deh). They want an immediate, calm, focused desktop tool that launches games in 1 click without cognitive clutter, visual noise, or toy-like gimmickry.

## Product Purpose

A high-performance, distraction-free desktop game manager and launcher. It unifies port detection, IWAD management, preset load orders, and mod cataloging into a fast, effortless workflow where the tool gets out of the player's way and lets them play.

## Positioning

Unlike bloated, over-decorated launchers or archaic Win32 utilities with poor UX, RNT Launcher offers an ultra-clean, utilitarian desktop experience inspired by professional creative/developer tools (Linear, Prism Launcher, GitHub Desktop) with instant responsiveness, zero visual slop, and rock-solid execution.

## Operating Context

Runs locally on Windows, Linux, and macOS as a self-contained desktop binary. Users interact via keyboard and mouse, configuring load orders, searching large mod libraries, and executing source port processes with real-time telemetry.

## Capabilities and Constraints

- Capabilities: Source port detection & registration, IWAD lump inspection and SHA-256 verification, mod archive extraction and lump reading, load order drag-and-drop reordering with enablement toggles, launch profile persistence, custom CLI launch arguments, save game directory isolation, non-blocking execution monitoring, and /idgames archive integration.
- Constraints: 100% backward compatibility with SQLite database schema, profile JSON schemas, and Wails backend bindings (`app.go`). Must build cleanly into a native executable and pass all 16 Go test packages.

## Brand Commitments

- Name: RNT Launcher
- Philosophy: Beautifully simple. Zero clutter. Calm, native, dependable utility. High information readability without badge soup, glowing halos, or decorative gimmickry.

## Product Principles

1. Earned Familiarity: Standard, predictable desktop UX patterns (sidebar, split views, clear tables/lists, standard inputs) over novel, idiosyncratic micro-interactions.
2. Signal Over Noise: Eliminate badge explosion, decorative glows, and nested card mazes. Reserve color for semantic state and primary actions.
3. Speed to Play: The primary job is launching the game. A preset can be selected and launched within two seconds.
4. Clean Separation: Play (Presets & Launchpad), Mods (Catalog & Inspector), and Settings (Engines, IWADs, Folders, Logs).
