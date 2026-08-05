# ROTRG PWA — koraci nakon izmjena

## 1. Dodaj server-only Supabase ključ u Vercel

U Supabase projektu pronađi `service_role` ključ, zatim u Vercelu otvori:

`Project → Settings → Environment Variables`

Dodaj varijablu:

```text
SUPABASE_SERVICE_ROLE_KEY=tvoj_service_role_ključ
```

Važno:

- nemoj koristiti prefiks `NEXT_PUBLIC_`;
- nemoj ovaj ključ stavljati u browser kod;
- nemoj ga slati u GitHub;
- nakon dodavanja uradi novi Vercel deployment.

Ostale potrebne Vercel varijable su:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
SUPABASE_SERVICE_ROLE_KEY
```

## 2. Omogući nove vrijednosti smjena u Supabaseu

U novoj verziji smjene su `7:00`, `15:30`, `Whole day` i `Other`. Vrijednost za
`Other` se čuva zajedno sa početnim i završnim vremenom u postojećoj koloni
`work_schedule.shift_type`, tako da nije potrebna nova tabela ili kolona.

Ako je `shift_type` već obični `text` bez starog CHECK ograničenja, ovaj korak
možeš preskočiti. Ako Supabase pri čuvanju nove smjene prijavi grešku, otvori:

`Supabase → SQL Editor → New query`

Zatim kopiraj i pokreni sadržaj fajla `SUPABASE-SHIFT-MIGRATION.sql`. Skripta
zadržava postojeće rasporede i dozvoljava nove vrijednosti.

## 3. Omogući dodjelu vozila i brisanje dostupnosti

Prije postavljanja ove verzije otvori:

`Supabase → SQL Editor → New query`

Kopiraj i pokreni cijeli sadržaj fajla
`SUPABASE-CAR-ASSIGNMENT-MIGRATION.sql`. Ovo je obavezan jednokratni korak za
novu verziju. Skripta:

- dodaje `car_id` u postojeću tabelu `work_schedule`;
- povezuje raspored sa tabelom `cars`;
- omogućava adminu da dodijeli ili promijeni vozilo;
- omogućava vozaču da obriše vlastitu prijavu dostupnosti;
- ne briše postojeće vozače, vozila ni rasporede.

Ako skriptu slučajno pokreneš ponovo, neće ponovo dodati istu kolonu, strani
ključ ili indeks.

## 4. Omogući Bled prijavu

Za novu Bled opciju u Supabase SQL Editoru jednom pokreni cijeli sadržaj fajla
`SUPABASE-BLED-MIGRATION.sql`.

Skripta dodaje dnevno `bled` Yes/No polje u `work_schedule`. Postojeći rasporedi
ostaju sačuvani i automatski dobijaju vrijednost `false` odnosno **No**. Također
dozvoljava da vozač izabere samo Bled, bez obavezne normalne smjene.

## 5. Prebaci izmjene u GitHub

Prekopiraj izmijenjene fajlove u svoj lokalni projekat, zatim pokreni:

```bash
npm install
npm run build
```

Ako build prođe, uradi commit i push. Vercel će automatski napraviti deployment.

## 6. Provjeri novi raspored i vozila

1. Kao vozač izaberi sutrašnju smjenu, zatim je ponovo pritisni da je ukloniš.
2. Provjeri da današnji datum jeste zaključan.
3. Za budući dan uključi **Bled → Yes**, a zatim provjeri da se vozač pojavio u
   adminovoj Bled grupi za isti dan.
4. Kao admin otvori raspored, izaberi dan i dodijeli vozilo vozaču.
5. Ponovo otvori vozačevu početnu stranicu ili **My schedule** i provjeri vozilo.
6. U **Vehicles** pritisni vozilo, izaberi fotografije i potvrdi da se upload
   otvara odmah te prikazuje smanjenu veličinu slika.

## 7. Ponovo instaliraj PWA na telefonu

Zbog promjene načina čuvanja sesije i starog service workera:

1. obriši staru ROTRG ikonicu sa Home Screena;
2. otvori novu Vercel verziju aplikacije;
3. ponovo je dodaj na Home Screen;
4. prijavi se jednom unutar instalirane aplikacije;
5. na početnoj stranici pritisni **Enable** kod obavijesti;
6. potvrdi sistemsku dozvolu za obavijesti.

Nakon toga zatvori aplikaciju i ponovo je otvori. Korisnik treba ostati prijavljen.

## 8. Test notifikacije

1. Prijavi se kao vozač i uključi obavijesti.
2. U Supabase tabeli `push_subscriptions` provjeri da se pojavio novi red.
3. Prijavi se kao admin.
4. Dodaj obavijest.
5. Zatvori vozačevu aplikaciju i provjeri stiže li push na telefon.

Na iPhoneu je potreban iOS/iPadOS 16.4 ili noviji, a web push radi iz aplikacije dodane na Home Screen.
