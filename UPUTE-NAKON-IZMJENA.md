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

## 2. Prebaci izmjene u GitHub

Prekopiraj izmijenjene fajlove u svoj lokalni projekat, zatim pokreni:

```bash
npm install
npm run build
```

Ako build prođe, uradi commit i push. Vercel će automatski napraviti deployment.

## 3. Omogući nove vrijednosti smjena u Supabaseu

U novoj verziji smjene su `7:00`, `15:30`, `Whole day` i `Other`. Vrijednost za
`Other` se čuva zajedno sa početnim i završnim vremenom u postojećoj koloni
`work_schedule.shift_type`, tako da nije potrebna nova tabela ili kolona.

Ako je `shift_type` već obični `text` bez starog CHECK ograničenja, ovaj korak
možeš preskočiti. Ako Supabase pri čuvanju nove smjene prijavi grešku, otvori:

`Supabase → SQL Editor → New query`

Zatim kopiraj i pokreni sadržaj fajla `SUPABASE-SHIFT-MIGRATION.sql`. Skripta
zadržava postojeće rasporede i dozvoljava nove vrijednosti.

## 4. Ponovo instaliraj PWA na telefonu

Zbog promjene načina čuvanja sesije i starog service workera:

1. obriši staru ROTRG ikonicu sa Home Screena;
2. otvori novu Vercel verziju aplikacije;
3. ponovo je dodaj na Home Screen;
4. prijavi se jednom unutar instalirane aplikacije;
5. na početnoj stranici pritisni **Enable** kod obavijesti;
6. potvrdi sistemsku dozvolu za obavijesti.

Nakon toga zatvori aplikaciju i ponovo je otvori. Korisnik treba ostati prijavljen.

## 5. Test notifikacije

1. Prijavi se kao vozač i uključi obavijesti.
2. U Supabase tabeli `push_subscriptions` provjeri da se pojavio novi red.
3. Prijavi se kao admin.
4. Dodaj obavijest.
5. Zatvori vozačevu aplikaciju i provjeri stiže li push na telefon.

Na iPhoneu je potreban iOS/iPadOS 16.4 ili noviji, a web push radi iz aplikacije dodane na Home Screen.
