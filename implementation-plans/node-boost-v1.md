# node-boost v1 roadmap — MCP, guidelines/skills i warstwa architektoniczna FE dla projektów Node (React: Next.js + Vite SPA)

> Zaktualizowano 2026-07-07 po sesji grillowania planu (11 pytań). Decyzje z grilla oznaczone [G#].
> Ten dokument traktujemy jako roadmapę v1. Pierwszy wykonywalny plan wdrożenia jest w `implementation-plans/node-boost-e1-foundation.md`.

## 0. Zakres (Scope) / Poza zakresem (Out of scope)

**Scope (robimy teraz):**
- Pakiet npm **`node-boost`** (unscoped, nazwa wolna — sprawdzone 2026-07-07), publiczny OSS od pierwszego wydania, licencja MIT [G1][G2]. Przy publikacji rezerwujemy też org **`@node-boost`** na przyszłe pluginy [G3].
- **Jeden pakiet** (TypeScript, devDependency, binarka `npx node-boost <komenda>`) — bez monorepo, ale z twardymi granicami modułów (`src/{detect,compose,agents,mcp,audit}`) i **bez publicznego JS API** (tylko CLI + MCP), żeby przyszły split nie był breaking change [G3].
- **Architektura multi-stack od dnia pierwszego** [G11]: interfejs `StackAdapter` (detekcja, macierz zastosowalności wzorców, narzędzia routingu), zasoby w `resources/<stack>/`, reguły audytu tagowane per stack. **Treści v1 tylko dla Reacta w dwóch wariantach:**
  - **Next.js** (App Router; wsparcie wersji 15/16),
  - **React SPA (Vite + react-router 7)** [G10] — pełnoprawny stack, nie fallback.
- **Detekcja stacku** z `package.json` + zainstalowanych wersji: `next`, `react`, `vite`, `react-router`, `typescript`, `tailwindcss`, `zod`, `@tanstack/react-query`, `zustand`, `vitest`/`jest`, `playwright`, package manager (z lockfile), App Router vs Pages Router vs SPA.
- **Polityka wersji: N i N-1 (latest + jeden major wstecz)** — nie "wszystkie wersje" [G11]. Starsze majory dostają tylko `core`.
- **Instalator** `node-boost install` (interaktywny) + `node-boost update` (bez pytań, regeneracja z configu).
- **AI guidelines** komponowalne per pakiet + wersja (`core` + warianty majorów), z nadpisaniami użytkownika.
- **Agent Skills** (`SKILL.md`) instalowane wg wykrytych pakietów i wybranych architektur.
- **Serwer MCP** (stdio) — **5 narzędzi** read-only: `application_info` (ze spisem włączonych architektur), `list_routes` (Next-only w v1), `audit`, `explain_finding`, `doctor` [G8].
- **Warstwa architektoniczna FE** — 10 wzorców z macierzą zastosowalności per stack; 6 z regułami audytu (sekcja 5) [G5].
- **Audit + guard**: `node-boost audit` (scope `--changed`/`--all`/`--base <ref>`/ścieżki), `node-boost guard` (brama z exit code), `--agent` (kompaktowy JSON). **Inline-suppression** dla każdej reguły: komentarz `// nb-disable NB-ARCH-xxx -- <wymagane uzasadnienie>` (linia lub plik); suppression bez uzasadnienia = warn [W1].
- **Hooki agentów** [G7]: guard wpinany jako hook końca tury u **wszystkich trzech agentów** (Claude Code i Codex: event `Stop`; Cursor: `stop` w `.cursor/hooks.json`) przez jeden adapter protokołu `node-boost guard --hook <agent>` (czyta payload ze stdin, odpowiada w dialekcie agenta). Interfejs `Agent` ma capability `supportsHooks`.
- **Doctor**: raport stanu zasobów (drift `generatedWith`, brakujące pliki, walidacja configu).
- Wsparcie agentów: **Claude Code, Codex, Cursor**.
- **Wszystkie generowane pliki commitowane** (config, `.ai/**`, pliki agentów) — README opisuje wariant gitignore dla chętnych [G4].
- **Etap E4.5 — warsztaty wzorców** [G6]: przed napisaniem treści każdego wzorca sesja edukacyjna (research z autorytatywnych źródeł → omówienie → decyzja użytkownika: wchodzi / zmodyfikowany / wypada). Sesje łączone tematycznie. **Status: warsztat #1 (trio App Routera) odbyty 2026-07-07 — wszystkie 3 wzorce zatwierdzone, decyzje [W1] w sekcji 5. Pozostały: #2 granice (feature-modules, typed-contracts, state-management), #3 wzorce doradcze (custom-hooks, component-composition, styling-tailwind, testing-strategy).**
- **Dogfooding na realnych projektach** [G9]: `~/code/harvey-frontend` (Next 16, App Router, Tailwind 4, Vitest) oraz `~/code/crm-next` (Vite + react-router 7, react-query 5, zustand 5, zod 4, Mantine 8, orval) — w crm-next **bez commitowania wygenerowanych plików** (lokalna decyzja użytkownika). Fixture'y testowe w repo wystarczają dla CI; osobna demo-app nie jest must-have.

**Out of scope (świadomie nie robimy w tym wdrożeniu):**
- Hostowane Documentation API / semantic search (odpowiednik `search-docs` Boosta).
- Treści dla stacków: Vue/Nuxt, Angular, React Native, Svelte, backend Node — **roadmapa: third-party guidelines (v1.1) → Angular (gdy pojawi się realny projekt użytkownika) → Vue → RN** [G11].
- Agenci: Gemini CLI, GitHub Copilot, Junie.
- Narzędzia MCP wymagające runtime aplikacji: browser logs, database query, eval/tinker; narzędzia `list_guidelines`/`get_guideline` (redundantne — guidelines są commitowanymi plikami z indeksem) [G8].
- `list_routes` dla react-router (roadmapa; w v1 SPA dostaje czytelne "unsupported for this stack").
- Auto-fix w audycie; tryb "strict" hooków (`PostToolUse`/`afterFileEdit`) — architektura adaptera ma go nie blokować, ale nie wchodzi do v1 [G7].
- Mechanizm guidelines/skills z third-party pakietów npm — **podniesiony priorytet: v1.1** [G11]; format plików w v1 projektujemy pod niego.
- Telemetria, strona www, `node-boost uninstall`.

> Uwaga: "Out of scope" to nie backlog – to twarda granica zakresu tego pliku. Roadmapa po v1: third-party guidelines → Angular → Vue → RN.

## 1. Cel (co chcemy osiągnąć)

- Odpowiednik Laravel Boost + laravel-architecture-kit dla ekosystemu React/Node: jedno `npx node-boost install` daje agentowi AI (Claude Code / Codex / Cursor) pełny kontekst projektu oraz opinionated reguły architektoniczne z twardym guardem.
- Po wdrożeniu użytkownik może:
  1. zainstalować pakiet i wygenerować `.ai/guidelines`, `.ai/skills`, konfiguracje agentów, `.mcp.json` i hooki jedną komendą,
  2. dać agentowi narzędzia MCP do inspekcji projektu (wersje, trasy, audyt, diagnostyka),
  3. wymusić architekturę FE przez guard na końcu każdej tury agenta oraz w CI (`--base`).
- Kryterium sukcesu v1 [G1][G9]: node-boost działa end-to-end na `harvey-frontend` i `crm-next`, a autor używa go w codziennej pracy; pakiet opublikowany publicznie na npm.

## 2. Dlaczego to jest potrzebne

- W ekosystemie Node **nie istnieje odpowiednik Laravel Boost** (research 2026-07): są generyczne serwery MCP, ale nic, co łączy detekcję stacku → wersjonowane guidelines → skills → audyt architektury → hooki agentów.
- Laravel-architecture-kit rozwiązał to dla Laravela; frontendy tych samych zespołów zostają bez guidelines i guarda — agenci generują niespójny kod (fetch w komponentach klienckich, `"use client"` wszędzie, stan serwera w globalnym store).
- Wszystkie klocki istnieją, brakuje spinacza: MCP ma oficjalne SDK TS (`@modelcontextprotocol/sdk` 1.29.x), format Agent Skills jest ustandaryzowany, a **wszyscy trzej agenci mają już systemy hooków** (Claude Code settings, Codex hooks stabilne od v0.124.0, Cursor hooks od 1.7).

## 3. Założenia i ograniczenia

**Założenia:**
- Katalog `/Users/taqie/code/node-boost` jest pusty — greenfield (git init w ramach wdrożenia; repo publiczne GitHub).
- Projekt docelowy ma `package.json` i Node >= 20; package manager wykrywany z lockfile (npm/pnpm/yarn/bun).
- Wersje pakietów: z `node_modules/<pkg>/package.json` (dokładne), fallback do minimalnej wersji z range'a w `package.json`.
- Autor jest devem BE (Laravel) — **treści wzorców FE muszą przejść research + warsztat E4.5 przed akceptacją**; autorytetem są źródła (docsy React/Next/Vercel, bulletproof-react, Feature-Sliced Design), nie intuicja [G6].
- Stack pakietu: TypeScript strict, `citty` (CLI), `@clack/prompts`, `@modelcontextprotocol/sdk`, `ts-morph` (AST w audycie), `zod` (walidacja configu), `tsup` (build), `vitest` (testy). Treści i komunikaty **po angielsku** (publiczny OSS).
- Rejestracja MCP i hooków używa komendy świadomej package managera (np. `pnpm exec node-boost mcp`, `npm exec`, `bunx`) — generowanej z detekcji, nie gołego `npx`.

**Ograniczenia (ważne):**
- Czy robimy migrację danych? **Nie** — greenfield. Transfer idei wzorców z architecture-kit wyłącznie redakcyjny, przez warsztaty E4.5.
- Czy dodajemy UI? **Tak, wyłącznie CLI/TUI** (@clack); zero web UI.
- Czy zmieniamy kontrakty API/payload? **Definiujemy nowe**: schema `node-boost.json`, format `--agent` JSON, odpowiedzi MCP, protokoły hook-adapterów (sekcja 6). Traktowane poważnie od 0.1.0 (publiczny pakiet).
- Czy dotykamy produkcji/feature flag? **Nie** — devDependency, brak wpływu na runtime aplikacji konsumenta.
- Bezpieczeństwo: narzędzia MCP read-only; instalator pisze tylko w managed blocks i katalogach `.ai/`, `.claude/`, `.codex/`, `.cursor/`, `.node-boost/`; hooki instalowane wyłącznie po osobnym potwierdzeniu per agent.

## 4. Model danych (DB)

**Brak bazy danych** — odpowiednikiem modelu danych są pliki konfiguracyjne i ich schematy (walidowane zodem):

| "Encja" | Plik | Właściciel | Zawartość |
|---------|------|-----------|-----------|
| Konfiguracja projektu | `node-boost.json` (root konsumenta) | node-boost (generowany, edytowalny, commitowany) | `version`, `generatedWith`, `stack`, `agents[]`, `features{}`, `architectures[]`, `audit.exclude[]`, `audit.rules{}` |
| Wynik detekcji | w pamięci (`DetectedStack`) | runtime | stack (`next` / `vite-react`), pakiety + wersje major, router, package manager |
| Guidelines wynikowe | `.ai/guidelines/*.md` | generowane, commitowane | skomponowane markdowny per pakiet/architektura + indeks |
| Skills wynikowe | `.ai/skills/<nazwa>/SKILL.md` | generowane, commitowane | format Agent Skills (frontmatter `name`, `description`) |
| Nadpisania użytkownika | `.node-boost/guidelines/**`, `.node-boost/skills/**` | użytkownik | ścieżki zgodne z wbudowanymi → zastępują je |
| Konfiguracje agentów | `.mcp.json`, `CLAUDE.md`, `AGENTS.md`, `.codex/config.toml`, `.cursor/rules/*.mdc`, `.cursor/mcp.json` | współdzielone | wpisy node-boost tylko w managed blocks / dedykowanych plikach |
| Hooki agentów [G7] | `.claude/settings.json`, `.codex/hooks.json` (lub `[hooks]` w config.toml), `.cursor/hooks.json` | współdzielone | wpis `guard --hook <agent>` na event końca tury; merge bez niszczenia cudzych hooków |

**Checklist DB (zawsze uzupełnij):**
- [x] Jakie indeksy dodajemy i dlaczego? — **Nie dotyczy** (brak DB). Odpowiednik: indeks guidelines `.ai/guidelines/node-boost.md` (spis treści dla agenta).
- [x] Czy pivot ma `unique`? — **Nie dotyczy**. Odpowiednik: slug architektury, kod reguły (`NB-ARCH-xxx`) i slug stacku unikalne, walidowane testem.
- [x] Czy pivot ma `timestamps`? — **Nie dotyczy**. `generatedWith` (wersja pakietu) w configu zamiast timestampów — `doctor` wykrywa drift.
- [x] `cascadeOnDelete` / `restrictOnDelete`? — **Nie dotyczy**. `uninstall` poza zakresem; usuwanie ręczne opisane w README.
- [x] Nullable vs wymagane? — Schema configu: `version`, `agents`, `features` wymagane; `architectures`, `audit` opcjonalne z defaultami (zod `.default()`).

## 5. Flow runtime (jak to ma działać)

### Flow A: `npx node-boost install`
1. Walidacja: istnieje `package.json`; jeśli nie → exit 1 z komunikatem.
2. Detekcja (`DetectedStack`): stack `next` (App/Pages Router, `src/`?) lub `vite-react` (react-router?) lub `react-generic`; pakiety + wersje; package manager.
3. Prompty (@clack): agenci (domyślnie wykryci) → funkcje (guidelines/skills/MCP/architektura/hooki) → wzorce architektury (multiselect; preset rekomendowany zależny od stacku — macierz niżej) → **osobne potwierdzenie instalacji hooka per agent**.
4. Kompozycja guidelines: per wykryty pakiet `core` + wariant majora (polityka N/N-1); nadpisania z `.node-boost/guidelines/**` wygrywają po zgodności ścieżki; dołącz guidelines wybranych architektur; wygeneruj indeks. Kolejność deterministyczna (stabilne diffy).
5. Zapis: `.ai/guidelines/`, `.ai/skills/`, pliki agentów (managed blocks `<!-- node-boost:start/end -->` w `CLAUDE.md`/`AGENTS.md`; merge klucza `node-boost` w `.mcp.json`/`.codex/config.toml`/`.cursor/mcp.json`; `.cursor/rules/node-boost.mdc`; hooki wg zgód z kroku 3).
6. Zapis `node-boost.json` + podsumowanie (utworzone/nadpisane/pominięte pliki, następne kroki).
7. Idempotencja: ponowny `install`/`update` z tymi samymi odpowiedziami/configiem → zero diffu.

### Flow B: `node-boost mcp` (rejestrowane komendą świadomą PM, np. `pnpm exec node-boost mcp`)
1. Serwer stdio (`@modelcontextprotocol/sdk`), **5 narzędzi** [G8]:
   - `application_info` — Node/PM, stack, wersje pakietów, router, TS strict, **spis włączonych architektur** + `generatedWith`,
   - `list_routes` — Next: skan `app/**/{page,layout,route,error,loading}.*` → tabela tras (URL, typ, plik, segmenty dynamiczne); SPA: odpowiedź "unsupported for this stack" z podpowiedzią roadmapy,
   - `audit` — silnik wspólny z CLI, format `--agent`,
   - `explain_finding` — kod reguły → opis, uzasadnienie, wskazówka naprawy,
   - `doctor` — to samo co CLI `doctor --agent`.
2. stdout wyłącznie JSON-RPC; logi na stderr.

### Flow C: `node-boost audit [--changed|--all|--base <ref>|<paths>] [--agent]`
1. Scope: `--changed` = `git diff --name-only HEAD` + untracked; `--base <ref>` = diff względem merge-base (CI na PR) [G7]; `--all` = globy źródeł; jawne ścieżki wygrywają.
2. Reguły włączonych architektur (z configu), filtrowane przez `audit.exclude` i `audit.rules` (off/warn/err override), **tagowane per stack** — reguła Next nie odpala się w SPA.
3. Detektory: liniowe (regex, np. `"use client"`) i AST (ts-morph: importy cross-feature, wywołania fetch, granice klient/serwer). Jeden `Project` ts-morph na przebieg.
4. Raport: tabela human lub `--agent`; exit code 0/1 (err > 0 → 1).

### Flow D: `node-boost guard` i hooki [G7]
1. `guard` = `audit --changed --agent` z twardym exit code.
2. `guard --hook claude-code|codex|cursor` — **adapter protokołu**: czyta payload ze stdin, uruchamia audit na zmienionych plikach, odpowiada w dialekcie agenta (Claude Code: exit 2 + stderr blokuje zakończenie tury; Codex: schema hooków Codex; Cursor: JSON na stdout). Czysty Node, zero skryptów shell.
3. Eventy: Claude Code `Stop`, Codex `Stop`, Cursor `stop` — jeden raport na turę agenta. Tryb strict (`PostToolUse`/`afterFileEdit`) poza v1, adapter ma go umożliwiać.
4. CI: `node-boost guard --base origin/main` — przykładowy workflow GitHub Actions w README. **CI to jedyne nieomijalne miejsce guarda.**

### Wzorce architektoniczne v1 — macierz zastosowalności i egzekwowania [G5][G10]

| Wzorzec | Stack | Guideline+Skill | Reguły audytu v1 |
|---|---|---|---|
| `feature-modules` | oba | ✔ | **err**: deep import między feature'ami z pominięciem `index.ts` (AST) |
| `server-first-components` ✅[W1] | Next | ✔ | **err**: `"use client"` w `page.tsx`/`layout.tsx`; **warn**: `"use client"` w pliku bez hooków/handlerów/browser API. Guideline uczy idiomu Next 16 (`"use cache"`, Suspense/PPR) |
| `data-access-layer` ✅[W1] | oba | ✔ | **err**: `fetch`/axios/ky w komponencie klienckim (poza hookami query i warstwą); **warn** (Next): surowy `fetch` w RSC poza warstwą. Globy warstwy konfigurowalne (`audit.ruleOptions`, default `**/api/**`, `**/server/**`, `lib/api/**`, `route.ts`; kod generowany np. orval = warstwa). Guideline: Server Actions jako ścieżka mutacji |
| `typed-contracts` | oba | ✔ | **warn**: `JSON.parse`/response bez walidacji zod na granicy `api/` (heurystyka) |
| `state-management` | oba | ✔ | **warn**: dane serwerowe wkładane do globalnego store (heurystyka; SPA z zustand+react-query to główny przypadek) |
| `custom-hooks` | oba | ✔ | brak reguł (nie da się uczciwie statycznie) |
| `component-composition` | oba | ✔ | brak reguł (doradczy) |
| `styling-tailwind` | oba (gdy tailwindcss) | ✔ | brak reguł (od tego eslint-plugin-tailwindcss) |
| `testing-strategy` | oba (wg runnerów) | ✔ | brak reguł |
| `error-loading-boundaries` ✅[W1] | Next (App Router) | ✔ | **warn**: segment, którego `page.tsx` pobiera dane, bez `loading.tsx` ani `error.tsx` w gałęzi (licząc w górę drzewa — root-level wystarcza). Guideline: `error.tsx` jest kliencki, `reset()`, `not-found.tsx`, granularny Suspense pod PPR |

Zasada nadrzędna [G5]: **żadna reguła z false-positive rate powyżej kilku procent** — lepiej mniej reguł, którym się ufa, niż guard, który się wyłącza. Wentyl bezpieczeństwa [W1]: każda reguła respektuje inline-suppression `// nb-disable <kod> -- <uzasadnienie>`. Lista pozostałych wzorców może się zmienić po warsztatach E4.5.

✅[W1] = zatwierdzone na warsztacie #1 (2026-07-07): `server-first-components` zmodyfikowany (doszedł wentyl suppression), `data-access-layer` i `error-loading-boundaries` bez zmian merytorycznych.

**Błędy i fallbacki (wymagane):**
- Brak danych: brak `package.json` → exit 1 z instrukcją; brak `node_modules` → wersje z range'ów + warning; nie wykryto react → tylko guidelines `core` + wspólne narzędzia, z ostrzeżeniem.
- Tool fail (MCP): wyjątek w narzędziu → `isError: true` z komunikatem i kodem `NB-Exxx`, serwer nie pada.
- LLM fail / timeout: **nie dotyczy** (node-boost nie woła LLM); timeout parsowania pliku w audycie (>5 s) → skip z findingiem `warn parse-timeout`.
- Walidacja wejścia: `node-boost.json` niezgodny ze schemą → lista błędów zod + exit 1 (`doctor` pokazuje jako diagnozę); błąd składni TS w audytowanym pliku → `warn parse-error`, bez crasha; brak gita przy `--changed`/`--base` → fallback `--all` z warningiem; nieznany agent w `--hook` → exit 1 z listą wspieranych.
- Kolizje plików: istniejący `CLAUDE.md`/`AGENTS.md` → tylko managed block, treść użytkownika bajt-w-bajt nietknięta; cudze wpisy w `.mcp.json`/`hooks.json`/`config.toml` → merge, nadpisujemy wyłącznie własny klucz/wpis.

## 6. Format danych

```json
// node-boost.json (generowany, commitowany)
{
  "$schema": "node_modules/node-boost/schema.json",
  "version": 1,
  "generatedWith": "0.1.0",
  "stack": "next",
  "agents": ["claude-code", "codex", "cursor"],
  "features": { "guidelines": true, "skills": true, "mcp": true, "architecture": true, "hooks": true },
  "architectures": [
    "feature-modules", "server-first-components", "data-access-layer",
    "typed-contracts", "custom-hooks", "state-management", "error-loading-boundaries"
  ],
  "audit": {
    "exclude": ["src/legacy/**"],
    "rules": { "NB-ARCH-007": "off", "NB-ARCH-002": "warn" },
    "ruleOptions": {
      "NB-ARCH-003": { "dataLayerGlobs": ["**/api/**", "**/server/**", "lib/api/**", "src/orval/**"] }
    }
  }
}
```

```json
// Output `node-boost audit --changed --agent` (konwencja kompaktowa z architecture-kit)
{
  "v": 1, "ok": false, "cmd": "audit", "scope": "changed",
  "err": 2, "warn": 1, "scanned": 14, "skipped": 1,
  "findings": [
    { "rule": "NB-ARCH-003", "sev": "err", "file": "src/features/cart/components/CartList.tsx", "line": 12, "code": "fetch-in-client-component" },
    { "rule": "NB-ARCH-001", "sev": "err", "file": "src/features/checkout/hooks/useCheckout.ts", "line": 3, "code": "cross-feature-deep-import", "ref": "src/features/cart/internal/store.ts" },
    { "rule": "NB-ARCH-002", "sev": "warn", "file": "src/app/dashboard/page.tsx", "line": 1, "code": "use-client-in-page" }
  ]
}
// Agent rozwija kod przez MCP `explain_finding` lub CLI `node-boost explain NB-ARCH-003`
```

```json
// Odpowiedź MCP `application_info` (przykład: harvey-frontend)
{
  "node": "22.11.0", "packageManager": "npm@10.9.0", "typescript": { "version": "5.9.3", "strict": true },
  "stack": { "name": "next", "version": "16.2.9", "router": "app", "srcDir": true },
  "packages": { "react": "19.2.7", "tailwindcss": "4.3.1", "vitest": "4.1.9" },
  "boost": {
    "version": "0.1.0", "generatedWith": "0.1.0",
    "architectures": ["feature-modules", "server-first-components", "data-access-layer", "typed-contracts", "error-loading-boundaries"]
  }
}
// Dla crm-next: "stack": { "name": "vite-react", "router": "react-router@7" }, bez wzorców Next-only
```

```json
// Hook Cursor (.cursor/hooks.json) — analogiczne wpisy dla Claude Code i Codex generuje instalator
{
  "version": 1,
  "hooks": { "stop": [{ "command": "pnpm exec node-boost guard --hook cursor" }] }
}
```

Zapis do logów: brak plików logów; `NODE_BOOST_DEBUG=1` → szczegółowa diagnostyka na stderr (nie zaburza stdio MCP ani protokołów hooków).

## 7. Zmiany w UI

UI = CLI (@clack/prompts), komunikaty po angielsku:
- `install`: intro z wykrytym stackiem („Detected: Next.js 16 (App Router), React 19, TS strict, Tailwind 4, npm" / „Detected: Vite + React 19, react-router 7, react-query 5, zustand 5, yarn") → multiselect agentów → funkcje → wzorce (preset wg macierzy stacku) → zgody na hooki per agent → spinner → outro z listą plików i next steps.
- `audit`: tabela findingów (plik:linia, reguła, severity, skrót) + podsumowanie; `--agent` czysty JSON.
- `doctor`: sekcje ✔/✖ (config, pliki agentów, hooki, drift `generatedWith`, nadpisania użytkownika).
- Wszystkie komendy wspierają `--no-interaction` (defaulty) pod CI; spinnery @clack jako loading states.

## 8. Pliki do modyfikacji

Greenfield — wszystko CREATE, w kolejności etapów:

| Plik | Akcja | Co zrobić | Ryzyko/uwagi |
|------|-------|-----------|--------------|
| `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `eslint.config.js`, `.gitignore`, `LICENSE.md` | CREATE | Szkielet: name `node-boost`, `bin`, `files` (dist+resources+schema.json), engines >= 20, ESM, MIT | Publikacja placeholdera 0.0.1 + rezerwacja orga `@node-boost` wcześnie [G3] |
| `src/config/schema.ts` | CREATE | Schema zod `node-boost.json` (+ pole `stack`) + eksport JSON Schema przy buildzie | Kontrakt publiczny od 0.1.0 |
| `src/detect/stack.ts`, `src/detect/router.ts` | CREATE | Detekcja stacku `next`/`vite-react`/`react-generic`, wersji (node_modules → fallback min z range), PM, routera | Rozróżnienie next vs vite-react to fundament macierzy wzorców [G10] |
| `src/stacks/adapter.ts` + `next.ts`, `vite-react.ts` | CREATE | Interfejs `StackAdapter` (macierz wzorców, presety, routing tools) [G11] | Projektowane pod przyszłe adaptery (Angular/Vue/RN) bez przebudowy |
| `src/compose/guidelines.ts`, `src/compose/skills.ts` | CREATE | Selekcja core+major (polityka N/N-1), nadpisania z `.node-boost/**`, indeks | Kolejność deterministyczna |
| `src/agents/agent.ts` + `claude-code.ts`, `codex.ts`, `cursor.ts` | CREATE | Interfejs `Agent` (capabilities: guidelines/skills/mcp/**hooks**) + 3 implementacje; managed blocks, merge configów i hooków | Nie niszczyć treści/hooków użytkownika — testy edge |
| `src/hooks/adapter.ts` + `claude-code.ts`, `codex.ts`, `cursor.ts` | CREATE | `guard --hook <agent>`: stdin payload → audit → odpowiedź w dialekcie agenta [G7] | Trzy różne protokoły; testy na payloadach fixture |
| `src/cli/index.ts` + `src/cli/commands/{install,update,audit,guard,doctor,explain,mcp}.ts` | CREATE | Komendy citty; `update` = install bez promptów; `audit --base <ref>` | `--no-interaction` wszędzie |
| `src/mcp/server.ts` + `src/mcp/tools/*.ts` (5 narzędzi) | CREATE | Serwer stdio; narzędzia reużywają detect/compose/audit [G8] | stdout tylko JSON-RPC |
| `src/audit/engine.ts`, `src/audit/rule.ts`, `src/audit/reporters/{human,agent}.ts` | CREATE | Scope resolution (git, merge-base), reguły tagowane per stack, runner liniowy + ts-morph, inline-suppression `nb-disable` (z wymaganym uzasadnieniem), `ruleOptions` z configu [W1] | Jeden `Project` na przebieg |
| `src/audit/rules/<slug>.ts` (6 wzorców z regułami) | CREATE | Reguły `NB-ARCH-xxx` + teksty `explain` | Twarde `err` tylko przy pewności AST [G5] |
| `resources/react/guidelines/**` (`core.md`, `react/{core,18,19}.md`, `next/{core,15,16}.md`, `vite/core.md`, `react-router/{core,7}.md`, `zod/{core,3,4}.md`, `react-query/core.md`, `zustand/core.md`, `typescript/core.md`, `tailwindcss/{core,3,4}.md`, `testing/{vitest,playwright}.md`) | CREATE | Treści guidelines (EN) — **dopiero po warsztatach E4.5** | Macierz wersji z dogfooding projektów [G9][G10]; największa praca redakcyjna |
| `resources/react/skills/**/SKILL.md` (`next-development`, `react-development`, `spa-routing`, `tailwindcss-development`, `testing-frontend`) | CREATE | Skills w formacie Agent Skills | — |
| `resources/react/architectures/<slug>/{guideline.md, skill/SKILL.md}` (10 × 2) | CREATE | Treści wzorców — **po warsztatach E4.5** [G6] | Lista wzorców może się zmienić po warsztatach |
| `tests/fixtures/{next-app,vite-app,dirty-next-app,dirty-vite-app}/**` | CREATE | Fixture'y obu stacków, czyste + z celowymi naruszeniami | Bez realnego node_modules — mock manifestów |
| `tests/unit/**`, `tests/feature/**` | CREATE | Testy z sekcji 9 | — |
| `README.md` | CREATE | Quick start, narzędzia MCP, macierz wzorców, hooki, CI (GH Actions z `--base`), wariant gitignore, roadmapa | — |

Kolejność wdrożenia:
**E1** szkielet + detect + stacks + compose + config → **E2** agenci + install/update → **E3** MCP → **E4** audit/guard/explain + hook-adaptery → **E4.5** warsztaty wzorców (sesje edukacyjne, decyzje o liście) [G6] → **E5** treści guidelines/skills, doctor, README, dogfooding na harvey-frontend i crm-next [G9], publikacja `0.1.0`.

## 9. Testy

**Must-have (wymagane):**
- [ ] Test 1 (happy path, feature, bez mocków): `install --no-interaction` na fixture `next-app` i `vite-app` (tmp dir) → komplet plików dla 3 agentów + hooki, config zgodny ze schemą, preset wzorców zgodny z macierzą stacku, drugi run bez diffu (idempotencja).
- [ ] Test 2 (failure path, feature): katalog bez `package.json` → exit 1 z komunikatem; uszkodzony `node-boost.json` → `update` exit 1 z listą błędów walidacji.
- [ ] Test 3 (feature): `audit --all --agent` na `dirty-next-app` → `fetch-in-client-component` (err), `cross-feature-deep-import` (err), `use-client-in-page` (warn), exit 1; na `dirty-vite-app` → reguły Next-only NIE odpalają się; czyste fixture'y → `ok: true`, exit 0.
- [ ] Test 4 (unit): kompozycja — next@16 wybiera `next/core.md` + `next/16.md`; nadpisanie z `.node-boost/guidelines/` zastępuje wbudowany; brak node_modules → wersja z range'a; polityka N/N-1 (stary major → tylko core).
- [ ] Test 5 (feature): serwer MCP klientem in-memory → `application_info` zwraca stack + architektury; `list_routes` na next-app zwraca trasy z segmentami dynamicznymi, na vite-app zwraca "unsupported".
- [ ] Test 6 (edge, unit): `CLAUDE.md` z treścią użytkownika → poza managed blockiem bajt-w-bajt nietknięta; `.mcp.json`/`.cursor/hooks.json` z cudzymi wpisami → merge je zachowuje.
- [ ] Test 7 (edge, unit): błąd składni TS w audycie → `warn parse-error` bez crasha; brak gita przy `--changed` → fallback `--all` + warning.
- [ ] Test 8 (feature): hook-adaptery — payload fixture każdego agenta na stdin → poprawna odpowiedź w dialekcie (Claude Code exit 2 + stderr przy err; Cursor JSON na stdout; Codex schema) [G7].
- [ ] Test 9 (unit) [W1]: inline-suppression — `// nb-disable NB-ARCH-003 -- reason` wycisza finding w linii; suppression bez uzasadnienia → warn; `ruleOptions.dataLayerGlobs` przesuwa granicę warstwy (fetch w `src/orval/**` przestaje być findingiem).

**Nice-to-have (opcjonalne):**
- Snapshot testy `.ai/guidelines/*.md` per kombinacja stacku.
- Wydajność: `audit --all` na fixture 500 plików < 10 s.
- `doctor` wykrywa drift `generatedWith`.

## 10. Plan migracji (jeśli dotyczy)

Nie dotyczy — greenfield, brak danych i użytkowników. Transfer idei wzorców z laravel-architecture-kit odbywa się redakcyjnie przez warsztaty E4.5 (research → decyzja → treść); bez skryptów migracyjnych.

## 11. Logi / monitoring

- CLI: wyniki na stdout; ostrzeżenia/diagnostyka na stderr; `NODE_BOOST_DEBUG=1` → szczegółowe logi (detekcja, kompozycja, czasy).
- MCP i hook-adaptery: logi wyłącznie na stderr (stdout zarezerwowany dla protokołów).
- Metryki w outputach: `audit` → `scanned`, `skipped`, czas; `install`/`update` → liczby plików utworzonych/nadpisanych/pominiętych.
- Brak telemetrii sieciowej (decyzja odnotowana w README).

## 12. Definition of Done

- [ ] Wszystko z Scope zrobione (E1–E5), `npx node-boost install` działa end-to-end na **harvey-frontend** (Next 16) i **crm-next** (Vite+react-router; bez commitowania tam plików) [G9].
- [ ] Warsztaty E4.5 odbyte dla wszystkich wzorców, lista wzorców zatwierdzona przez autora [G6].
- [ ] Must-have testy (1–8) przechodzą w `vitest run`.
- [ ] `eslint` + `prettier --check` czyste; `tsc --noEmit` bez błędów.
- [ ] CLI działa: install interaktywny i `--no-interaction`, audit human/`--agent`/`--base`, doctor, hook-adaptery dla 3 agentów.
- [ ] Kontrakty zgodne z sekcją 6 (schema configu, format `--agent`, odpowiedzi MCP, protokoły hooków).
- [ ] `npm pack` zawiera dist+resources+schema.json; nazwa `node-boost` i org `@node-boost` zarezerwowane; README kompletne (quick start, CI, roadmapa: third-party guidelines v1.1 → Angular → Vue → RN) [G11].
