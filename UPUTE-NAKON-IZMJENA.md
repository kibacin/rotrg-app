# ROTRG — upute nakon izmjena

Aktuelne, objedinjene upute su u fajlu `DEPLOY-NEW-FEATURES.md`.

Za ovu verziju prvo pokreni `SUPABASE-COMPLETE-UPGRADE.sql`, zatim deployaj
Edge Function i pokreni `SUPABASE-CRON-SETUP.sql`. Stari pojedinačni migration
fajlovi ostavljeni su samo kao historija prethodnih verzija i ne trebaju se
ponovo pokretati.
