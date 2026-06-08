import { Elysia } from "elysia";
import { sqlite } from "../db";
import AdmZip from "adm-zip";
import { writeFileSync, readFileSync, readdirSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const BACKUP_DIR = "./backups";
if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR);

export const backupRoutes = new Elysia({ prefix: "/backup" })
  .post("/create", () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = join(BACKUP_DIR, `kiryana_${timestamp}.db`);
    // Use SQLite online backup
    const backupDb = new (require("bun:sqlite").Database)(backupFile);
    sqlite.backup(backupDb);
    backupDb.close();
    // Zip it
    const zip = new AdmZip();
    zip.addLocalFile(backupFile);
    const zipPath = backupFile.replace(".db", ".zip");
    zip.writeZip(zipPath);
    unlinkSync(backupFile);
    return { message: "Backup created", file: zipPath };
  })
  .get("/list", () => {
    const files = readdirSync(BACKUP_DIR).filter(f => f.endsWith(".zip"));
    return files.map(f => ({ name: f, path: join(BACKUP_DIR, f) }));
  })
  .post("/restore/:filename", ({ params: { filename } }) => {
    const zipPath = join(BACKUP_DIR, filename);
    const zip = new AdmZip(zipPath);
    const dbEntry = zip.getEntries().find(e => e.name.endsWith(".db"));
    if (!dbEntry) throw new Error("No database found");
    const tempDb = "/tmp/restore.db";
    writeFileSync(tempDb, dbEntry.getData());
    sqlite.close();
    require("fs").copyFileSync(tempDb, "kiryana.db");
    return { message: "Restored. Please restart server." };
  });