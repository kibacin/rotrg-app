# ROTRG hotfix: admin uploads, camera and chat notifications

Ovaj paket je napravljen iz trenutne produkcijske verzije i zadržava posljednji
ispravni `cleanup-expired-media` authentication fix. Pravilo za izvještaje auta
ostaje **minimalno 6, maksimalno 8 fotografija**.

## Šta se mijenja

- Aktivni admini i vozači mogu slati vehicle photo reports.
- Aktivni admini i vozači mogu slati cash-ride i fuel receipts.
- Mobilna kamera čeka da je video stvarno spreman prije pokretanja previewa,
  koristi lakšu rezoluciju, zaustavlja zaglavljeni stream i nudi ručni
  `Start preview` ako telefon blokira automatski prikaz.
- Svaka nova group-chat poruka obavještava sve ostale aktivne korisnike.
- Pošiljalac ne dobija obavijest za vlastitu poruku.
- `@mention` ostaje posebno označen.
- U Settings postoji `Mute group chat`. To utišava samo chat; vehicle
  assignments i announcements ostaju uključeni.

## Siguran redoslijed puštanja

### 1. Prvo Supabase SQL

U Supabase SQL Editoru pokreni kompletan sadržaj:

`SUPABASE-ADMIN-CAMERA-CHAT-HOTFIX.sql`

Ovaj SQL je idempotentan, ne briše postojeće korisnike, poruke, račune,
fotografije ili rasporede i kompatibilan je sa trenutno aktivnom verzijom
aplikacije.

Zatim pokreni:

`SUPABASE-VERIFY-ADMIN-CAMERA-CHAT-HOTFIX.sql`

Svih šest rezultata mora biti `true`.

### 2. Nova Git grana iz trenutnog maina

U VS Code terminalu, unutar postojećeg repozitorija:

```powershell
git fetch origin main
git switch -c hotfix-admin-camera-chat-2026-09-01 origin/main
```

Kopiraj sadržaj `rotrg` foldera iz ovog paketa preko sadržaja svog lokalnog
repozitorija. Ne briši `.git` niti svoj `.env.local`.

### 3. Lokalne provjere

`package.json` i `package-lock.json` nisu mijenjani, pa postojeći
`node_modules` može ostati. Pokreni:

```powershell
npm run lint
npm run build
git status --short
```

### 4. Preview prije produkcije

```powershell
git add app components SUPABASE-COMPLETE-UPGRADE.sql SUPABASE-VERIFY-UPGRADE.sql SUPABASE-ADMIN-CAMERA-CHAT-HOTFIX.sql SUPABASE-VERIFY-ADMIN-CAMERA-CHAT-HOTFIX.sql UPUTE-HOTFIX-ADMIN-CAMERA-CHAT.md
git commit -m "Fix admin uploads, camera and chat notifications"
git push -u origin hotfix-admin-camera-chat-2026-09-01
```

Na Vercel previewu provjeri najmanje:

1. Admin može otvoriti auto i napraviti 6 fotografija.
2. Admin može poslati jedan račun.
3. Kamera se otvara na jednom iPhoneu i jednom Androidu, zatim se zatvori i
   ponovo otvori.
4. Poruka jednog korisnika pošalje obavijest drugom korisniku kada je aplikacija
   otvorena i kada je zatvorena.
5. Nakon uključivanja `Mute group chat`, chat više ne obavještava taj račun,
   ali ostale vrste obavijesti ostaju aktivne.

Telefon i dalje mora imati uključenu opciju `Phone notifications` i sistemsku
dozvolu za obavijesti. `Mute group chat` ne može uključiti dozvolu koju je
korisnik blokirao u postavkama telefona.

### 5. Produkcija i rollback

Nakon preview provjere napravi PR prema `main` i merge. Ako se nakon objave
pojavi neočekivan problem, u Vercelu odmah redeployaj prethodni uspješni
production deployment. Supabase hotfix SQL može ostati: stara verzija aplikacije
ignoriše novu preference kolonu, a postojeći podaci ostaju netaknuti.
