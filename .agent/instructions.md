# Master Project Rules & Philosophy: 2D Game Engine V7

This document is the absolute authority for development on this project. All adaptations and feature evolutions must be cross-referenced with this file first.

## 1. Core Ethos & Philosophy
- **User-Centric Testing**: The User is the lead developer. They must test all UI and interaction changes manually before the agent performs automated verification.
- **Visual Sovereignty**: The engine MUST maintain a strictly responsive 16:9 aspect ratio. It should fill the available browser viewport without extraneous white space or scrollbars.
- **Design Efficiency**: Features should prioritize making level design easy (e.g., world panning, large world bounds, clear "Editor vs Game" states).

## 2. Mandatory Local Workflows
### A. Interactive Testing Lifecycle
- **Step 1**: Complete code implementation.
- **Step 2**: Provide the User with a **Manual Verification Checklist**.
- **Step 3**: Set `BlockedOnUser: true` and wait for the User to signal they are "Started" or "Ready for Agent Verification".
- **Step 4**: Only after the User's "Ready" signal, run the `browser_subagent` to record a final walkthrough.
- **Step 5**: **Pseudo-Cursor Requirement**: The `browser_subagent` MUST use a pseudo-cursor (software-simulated click/move) for all browser interactions. It should NOT hijack the user's hardware cursor, allowing the User to continue other activities on the machine simultaneously.

### B. Post-Feature Commit & Push
- **Step 1**: After successful verification, ask the User for permission to commit.
- **Step 2**: Only if authorized, run `git add`, `git commit`, and `git push -u origin main`.
- **Remote Repo**: `https://github.com/1984drum/2dp-engine`

## 3. Technical Hard-Requirements
- **Viewport**: All canvas scaling must happen within `containerRef` while maintaining the `ASPECT_RATIO = 16 / 9`.
- **World Bounds**: Use `WORLD_WIDTH = 5120` and `WORLD_HEIGHT = 2880`. Do not hardcode these values in new logic; reference the constants.
- **Pause State**: All physics and entity updates must respect the `isPaused` (Editor mode) state to allow safe level editing.

## 4. Maintenance & Evolution
- Before implementing any sub-workflow, the agent must check for conflicts with these Master Rules.
- If a conflict occurs, the agent must prompt the User to decide which rule takes precedence for that specific task.
