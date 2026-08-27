# ROTRG — tačan redoslijed za Supabase i deploy

Ovu verziju postavljaj ovim redoslijedom. Nova aplikacija očekuje novu bazu, pa
nemoj prvo pustiti Vercel deployment.

## 1. Provjeri Vercel varijable

U `Vercel → Project → Settings → Environment Variables` trebaju postojati:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` i `VAPID_PRIVATE_KEY` nikad ne smiju imati
`NEXT_PUBLIC_` prefiks i ne smiju se slati na GitHub.

## 2. Pokreni glavnu SQL migraciju

1. Napravi backup baze u Supabaseu.
2. Otvori `Supabase → SQL Editor → New query`.
3. Kopiraj kompletan sadržaj fajla `SUPABASE-COMPLETE-UPGRADE.sql`.
4. Pritisni **Run** i sačekaj poruku da je query uspješno završen.

Ovo je jedini glavni migration fajl koji treba pokrenuti za ovu verziju.
Nemoj poslije njega posebno pokretati stare fajlove
`SUPABASE-SHIFT-MIGRATION.sql`, `SUPABASE-BLED-MIGRATION.sql`,
`SUPABASE-CAR-ASSIGNMENT-MIGRATION.sql` ili
`SUPABASE-NEW-FEATURES-MIGRATION.sql`.

Migracija čuva postojeće vozače, aute, rasporede, račune, najave i slike. Dodaje:

- aktivne/neaktivne naloge vozača;
- rok za izmjenu sutrašnjeg rasporeda u 16:30 po vremenu Ljubljane;
- audit i admin obavijest za svaku stvarnu izmjenu smjene ili Bleda;
- odvojenu dodjelu vozila za redovnu smjenu i Bled;
- izvještaje vozila sa obaveznih 6–8 slika;
- privatne račune goriva i gotovinske vožnje;
- najave sa do 3 slike i istekom nakon 48 sati;
- vozila i servisnu historiju;
- zajednički chat, tagovanja i obavijesti;
- potrebne RLS politike, indekse i Storage buckete.

## 3. Deploy funkcije za automatsko brisanje

Funkcija briše:

- najave i njihove slike nakon 48 sati;
- slike vozila nakon 30 dana;
- račune goriva i gotovinske vožnje nakon 30 dana;
- nedovršene draft izvještaje i njihove privremene slike.

Iz root direktorija projekta pokreni:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref TVOJ_PROJECT_REF
npx supabase@latest functions deploy cleanup-expired-media
```

Kod funkcije se nalazi u
`supabase/functions/cleanup-expired-media/index.ts`. Supabase automatski daje
funkciji `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY`; ne dodaji ih u frontend.

## 4. Uključi automatski cron

1. Otvori `SUPABASE-CRON-SETUP.sql`.
2. Zamijeni `https://YOUR_PROJECT_REF.supabase.co` stvarnim Project URL-om.
3. Zamijeni `YOUR_SERVICE_ROLE_KEY` stvarnim service-role ključem.
4. Kopiraj cijeli query u Supabase SQL Editor i pokreni ga jednom.
5. Ne snimaj popunjeni service-role ključ u projekat ili GitHub.

Cron se izvršava svakog sata u 17. minuti. Sadržaj prestaje biti vidljiv tačno
nakon isteka, a fizičko brisanje iz baze i Storagea završi najkasnije pri
sljedećem satu.

Nakon toga u SQL Editoru pokreni `SUPABASE-VERIFY-UPGRADE.sql`. Sva polja sa
sufiksom `_ready` trebaju biti `true`, a `cleanup_cron_jobs` treba biti `1`.

## 5. Deploy aplikacije

```bash
npm install
npm run lint
npm run build
git add .
git commit -m "Complete ROTRG fleet workflow upgrade"
git push
```

Vercel bi nakon pusha trebao automatski napraviti deployment. Ako si tek dodao
environment varijable, pokreni novi production deployment.

## 6. Brzi test nakon deploya

1. Admin napravi testnog vozača, odjavi se i provjeri novu prijavu.
2. Vozač izabere smjenu i Bled za budući dan; admin treba dobiti in-app i push
   obavijest. Poslije 16:30 provjeri da sutrašnji dan više nije moguće mijenjati.
3. Admin dodijeli redovni auto i drugi Bled auto; vozač treba dobiti dvije
   obavijesti i oba auta vidjeti u svom rasporedu.
4. Vozač napravi izvještaj vozila. Dugme za slanje mora ostati blokirano dok
   kamera ne napravi najmanje 6 slika, a galerija se ne smije nuditi.
5. Vozač pošalje račun gotovinske vožnje, račun dizela i račun benzina. Admin
   treba vidjeti sva tri, a drugi vozač samo svoje.
6. Admin objavi najavu sa 3 slike i provjeri push obavijest.
7. Vozač i admin pošalju poruke u grupni chat i međusobno se označe sa `@`.
8. Admin doda novi auto i servisni izvještaj, pa provjeri historiju tog auta.
9. Admin ukloni testnog vozača. Prijava tog naloga mora biti blokirana, dok
   historijski rasporedi i dokumenti ostaju sačuvani; zatim testiraj vraćanje.
10. U profilu provjeri Sign out, veličinu teksta, easy-reading, high contrast i
    smanjene animacije.

Za iPhone web push potreban je iOS/iPadOS 16.4 ili noviji i aplikacija dodana na
Home Screen.
