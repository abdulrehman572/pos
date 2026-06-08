#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::process::Command;

#[tauri::command]
fn print_receipt(html: String) -> Result<(), String> {
    // Save HTML to a temporary file
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join("kiryana_receipt.html");
    std::fs::write(&file_path, &html).map_err(|e| e.to_string())?;

    // On Windows: open with default browser and trigger print
    #[cfg(target_os = "windows")]
    {
        // Use rundll32 to print the HTML file silently (may show dialog)
        let output = Command::new("rundll32")
            .args(&["printui.dll,PrintUIEntry", "/y", "/n", "PDF"])
            .output();
        // Alternatively, open in Edge/Chrome with print flag:
        Command::new("cmd")
            .args(&["/C", "start", file_path.to_str().unwrap(), "/P"])
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    // On Linux / macOS you would use lp or lpr
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("lp")
            .arg(file_path.to_str().unwrap())
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![print_receipt])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}