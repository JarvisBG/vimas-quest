// ============================================================================
// Banc SANS PostgreSQL installé : PGlite (PostgreSQL 17 en WebAssembly, Node).
// Joue des fichiers SQL sur une base vierge « façon Supabase », puis écrit
// l'audit (outils/audit_base.sql) au format de outils/audit_attendu.csv.
//
// Préparation (une fois, HORS du dépôt, ex. dans un dossier temporaire) :
//   npm install @electric-sql/pglite
// puis lancer ce fichier depuis ce dossier-là (NODE_PATH ne marche pas en ESM) :
//   copier audit_pglite.mjs dans le dossier, puis
//   node audit_pglite.mjs <sortie.csv> <fichier.sql> [<fichier.sql> …]
// Exemple (vérifier que 00_schema.sql donne l'audit attendu) :
//   node audit_pglite.mjs audit.csv <dépôt>/supabase/00_schema.sql <dépôt>/supabase/01_reference.sql
//
// 00_imiter_supabase.sql est joué d'abord, automatiquement. Un fichier qui
// échoue arrête tout (message de PostgreSQL affiché).
// Le 28/09/2026, l'audit de 00_schema.sql sous PGlite était identique à
// audit_attendu.csv (relevé sur PostgreSQL 18 et sur Supabase).
// ============================================================================
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const [sortie, ...fichiers] = process.argv.slice(2);
if (!sortie || !fichiers.length) {
  console.error("Usage : node audit_pglite.mjs <sortie.csv> <fichier.sql> [...]");
  process.exit(1);
}
// Ce fichier est normalement copié hors du dépôt : on retrouve outils/ par le schéma donné.
const ici = path.dirname(fileURLToPath(import.meta.url));
const outils = fs.existsSync(path.join(ici, "00_imiter_supabase.sql"))
  ? path.join(ici, "..")
  : path.join(path.dirname(path.resolve(fichiers[0])), "outils");

const db = new PGlite({ extensions: { pgcrypto, uuid_ossp, btree_gist } });
for (const f of [path.join(outils, "banc", "00_imiter_supabase.sql"), ...fichiers]) {
  try { await db.exec(fs.readFileSync(f, "utf8")); console.log("OK ", f); }
  catch (e) { console.error("ERR", f, "→", e.message); process.exit(1); }
}
const sql = fs.readFileSync(path.join(outils, "audit_base.sql"), "utf8").replace(/;\s*$/, "");
const q = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const lignes = ["genre,objet,detail",
  ...(await db.query(sql)).rows.map((x) => [x.genre, x.objet, x.detail].map((v) => q(String(v ?? ""))).join(","))];
fs.writeFileSync(sortie, lignes.join("\n") + "\n");
console.log(lignes.length - 1, "lignes d'audit →", sortie);
