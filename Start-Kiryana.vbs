Set shell = CreateObject("WScript.Shell")
root = Replace(WScript.ScriptFullName, "Start-Kiryana.vbs", "")
script = root & "run-kiryana-hidden.ps1"
command = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & script & """"
shell.Run command, 0, false
