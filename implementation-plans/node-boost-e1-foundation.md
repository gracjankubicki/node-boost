# node-boost E1 — fundament pakietu, detekcja stacku i kompozycja zasobow

Status: complete — implemented and pushed to GitHub on 2026-07-07.

## 1. Cel

Zbudowac pierwszy pionowy fundament `node-boost`, na ktorym da sie bezpiecznie oprzec kolejne etapy z roadmapy `node-boost-v1.md`.

Po tej iteracji repo ma miec dzialajacy szkielet pakietu TypeScript, podstawowy kontrakt konfiguracji, detekcje stacku, adaptery stackow i minimalna kompozycje zasobow. Nie wdrazamy jeszcze agentow, MCP, audytu, hookow ani finalnych tresci wzorcow FE.

## 2. Scope

Robimy teraz:

- inicjalizacja repozytorium git w tym katalogu i szkieletu npm package `node-boost`,
- utworzenie/podpiecie publicznego repo GitHub po lokalnej weryfikacji E1 i push pierwszego commita,
- konfiguracja TypeScript strict, build, test runner i podstawowe skrypty,
- schema `node-boost.json` w zod jako pierwszy publiczny kontrakt,
- detekcja stacku z `package.json`, lockfile i opcjonalnego `node_modules`,
- wykrywanie package managera,
- wykrywanie Next.js App Router / Pages Router oraz Vite + React Router,
- interfejs `StackAdapter` i adaptery `next` oraz `vite-react`,
- minimalna kompozycja guidelines/skills z resources, z deterministyczna kolejnoscia,
- fixture'y dla `next-app` i `vite-app`,
- testy dla detekcji, schemy, adapterow i kompozycji.

Poza zakresem tej iteracji:

- `install`/`update` generujace pliki w projektach konsumentow,
- konfiguracje agentow: Claude Code, Codex, Cursor,
- serwer MCP i narzedzia MCP,
- `audit`, `guard`, `explain`, hook-adaptery,
- finalne tresci guidelines/skills dla wzorcow architektonicznych,
- warsztaty E4.5,
- dogfooding na `harvey-frontend` i `crm-next`,
- publikacja npm.

## 3. Rekomendowana sciezka

Najpierw postawic maly, testowalny core bez side effectow w projektach konsumentow. Detekcja, schema i adaptery sa fundamentem dla instalatora, MCP i audytu, wiec powinny powstac przed warstwa agentow i przed pisaniem tresci wzorcow.

Rekomendowany przebieg:

1. Utworzyc minimalny package i konfiguracje narzedzi.
2. Zdefiniowac typy domenowe: `DetectedStack`, `PackageInfo`, `StackAdapter`, `NodeBoostConfig`.
3. Zaimplementowac detekcje package managera i zaleznosci.
4. Zaimplementowac adaptery `next` i `vite-react` z presetami architektur.
5. Zaimplementowac minimalny composer resources.
6. Dopiero potem dodac CLI placeholder lub cienki entrypoint pod przyszle komendy, jesli wymaga tego `bin`.
7. Pokryc wszystko testami na fixture'ach.

## 4. Checklist zadan

- [x] Zainicjalizowac repozytorium git, jesli nadal go nie ma.
- [x] Po przejsciu lokalnej weryfikacji utworzyc/podpiac publiczne repo GitHub dla `node-boost`.
- [x] Zrobic pierwszy commit i push do GitHuba.
- [x] Dodac `package.json` z nazwa `node-boost`, ESM, `bin`, `engines >= 20`, `files` i skryptami.
- [x] Dodac `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `eslint.config.js`, `.gitignore`, `LICENSE.md`.
- [x] Dodac `src/config/schema.ts` ze schema zod dla `node-boost.json`.
- [x] Dodac typy wspolne dla stacku, pakietow, routera, agentow i features.
- [x] Dodac `src/detect/stack.ts` i helpers do czytania `package.json`, lockfile oraz wersji z `node_modules`.
- [x] Dodac wykrywanie package managera: npm, pnpm, yarn, bun.
- [x] Dodac wykrywanie Next: wersja, App Router vs Pages Router, `src/`.
- [x] Dodac wykrywanie Vite React + React Router 7.
- [x] Dodac fallback `react-generic` tylko jako wykryty stan, bez pelnych tresci v1.
- [x] Dodac `src/stacks/adapter.ts`, `src/stacks/next.ts`, `src/stacks/vite-react.ts`.
- [x] Dodac macierz/presety architektur zgodne z roadmapa dla Next i Vite React.
- [x] Dodac `src/compose/guidelines.ts` i `src/compose/skills.ts` w minimalnym zakresie.
- [x] Dodac minimalne resources testowe potrzebne do kompozycji.
- [x] Dodac fixture'y `tests/fixtures/next-app` i `tests/fixtures/vite-app`.
- [x] Dodac testy unit/feature dla detekcji, adapterow, schemy i kompozycji.
- [x] Uruchomic self-review diffu przed raportem.

## 5. Oczekiwane pliki i moduly

Nowe pliki konfiguracyjne:

- `package.json`
- `tsconfig.json`
- `tsup.config.ts`
- `vitest.config.ts`
- `eslint.config.js`
- `.gitignore`
- `LICENSE.md`

Nowe moduly:

- `src/config/schema.ts`
- `src/detect/stack.ts`
- `src/detect/router.ts`
- `src/detect/package-manager.ts`
- `src/stacks/adapter.ts`
- `src/stacks/next.ts`
- `src/stacks/vite-react.ts`
- `src/compose/guidelines.ts`
- `src/compose/skills.ts`
- `src/cli/index.ts` tylko jako minimalny entrypoint, jesli wymagany przez `bin`

Nowe testy i fixture'y:

- `tests/fixtures/next-app/**`
- `tests/fixtures/vite-app/**`
- `tests/unit/**`
- `tests/feature/**`

## 6. Testy i weryfikacja

Minimalna weryfikacja tej iteracji:

- `npm test` albo projektowy odpowiednik `vitest run`,
- `npm run typecheck`,
- `npm run lint`,
- `npm run build`,
- test idempotentnej kompozycji resources na fixture'ach,
- test fallbacku wersji z range'a, gdy brak `node_modules`,
- test polityki N/N-1 dla wyboru resources,
- test walidacji poprawnego i uszkodzonego `node-boost.json`.

Jesli ktorys check nie bedzie mozliwy do uruchomienia, raport koncowy musi wskazac dokladnie ktory, dlaczego i jakie ryzyko zostaje.

## 7. Ryzyka

- Kontrakt `node-boost.json` od 0.1.0 bedzie publiczny, wiec schema nie powinna powstac przypadkowo pod jeden test.
- Detekcja wersji z range'a moze byc przyblizona; trzeba jasno odroznic wersje dokladne z `node_modules` od minimalnych wersji z deklaracji.
- Adapter `StackAdapter` ma wspierac przyszle stacki, ale nie powinien urosnac w abstrakcje pod Vue/Angular, zanim mamy realne use case'y.
- Composer nie moze zakladac finalnych tresci E4.5; w tej iteracji resources moga byc minimalne/testowe.
- Bez instalatora nie ma jeszcze end-to-end wartosci dla konsumenta; ta iteracja jest fundamentem, nie gotowym produktem.

## 8. Blokujace pytania

Brak pytan blokujacych dla E1.

Decyzja: inicjalizujemy git w `/Users/taqie/code/node-boost`, a po lokalnej weryfikacji E1 od razu przenosimy repo do GitHuba.

## 9. Kryteria akceptacji

- Repo ma dzialajacy szkielet npm package `node-boost`.
- Repo jest zainicjalizowane lokalnie, ma pierwszy commit i jest wypchniete do GitHuba.
- `DetectedStack` poprawnie rozpoznaje fixture Next i Vite React.
- Adaptery zwracaja presety architektur zgodne z roadmapa.
- Schema configu waliduje poprawne configi i odrzuca uszkodzone.
- Composer wybiera deterministicznie resources wg stacku i wersji.
- Testy, typecheck, lint i build przechodza albo brak weryfikacji jest jawnie udokumentowany.

## 10. Dowody wykonania

- GitHub: `https://github.com/gracjankubicki/node-boost`
- Commit: pierwszy commit na branchu `main`.
- Weryfikacja lokalna:
  - `npm run check` — typecheck, lint, 10 testow Vitest i build przeszly.
  - `npm pack --dry-run` — paczka zawiera `dist`, `resources`, `schema.json`, `README.md`, `LICENSE.md`.
  - `npm audit --audit-level=moderate` — exit 0; pozostaje 1 low severity advisory w transitive `esbuild` z toolchainu dev/build.
