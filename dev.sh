#!/bin/bash
bunx tailwindcss -i frontend/css/input.css -o frontend/css/output.css --watch &
bun --watch backend/src/index.ts
