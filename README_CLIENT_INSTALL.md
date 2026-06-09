Client install instructions

1) Copy the entire `KiryanaPOS` folder to the client's machine (USB, network share, or zip).
2) Open an elevated PowerShell (Run as Administrator).
3) Change directory to the copied folder, e.g.:

```powershell
cd C:\KiryanaPOS
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-client.ps1
```

This will copy files to `C:\KiryanaPOS`, create a public Desktop shortcut `Kiryana POS`, and add a firewall rule for port 3000.

Notes:
- The shortcut runs `Start-Kiryana.bat` which executes `run-kiryana-windows.ps1` to start the server and open the browser.
- If PowerShell execution is blocked, run the `powershell -ExecutionPolicy Bypass` command above.
- If Bun or other dependencies are missing on the client, `start-kiryana.ps1` will attempt to install Bun and run `bun install` the first time the server runs. Ensure the client machine has internet access during first run.
- For per-user Desktop shortcuts, edit `install-client.ps1` to write to the user's Desktop instead of the common Desktop.

Optional manual steps:
- Create a Start Menu shortcut pointing to the same `.bat`.
- Replace the icon file at `logo\favicon.ico` with a custom icon; the installer will use it if present.

If you want, I can also create an automated ZIP/installer generator or produce a `.msi` using WiX — tell me which and I'll prepare it.