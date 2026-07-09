# Kriminalita v Česku 2008–2025

Interaktivní vzdělávací přehled vývoje kriminality v České republice na základě
**otevřených dat Policie ČR**. Ukazuje, že evidovaná kriminalita dlouhodobě klesá —
grafy, mapa krajů a filtrování podle druhu trestné činnosti.

## Spuštění

Stránka je statická, ale načítá data přes `fetch()`, takže potřebuje HTTP server
(ne `file://`):

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Co web ukazuje

- **Celkový trend** evidovaných trestných činů 2008–2025 (absolutně i na 100 tis. obyvatel).
- **Průzkumník** — výběr kategorie nebo konkrétního trestného činu (~150 druhů dle TSK);
  zvolený druh se propíše do grafu trendu i do mapy.
- **Interaktivní mapa 14 krajů** (choropleth) s časovou osou a detailem po kliknutí na kraj.
- **Struktura kriminality** — kategorie v čase, změna 2008→2025, nejčastější činy, objasněnost.
- U každého grafu je **odkaz na zdroj** pro ověření.

## Technologie

- **Apache ECharts** (grafy i mapa) — jedna knihovna, licence Apache 2.0.
- Vanilla JS + HTML + CSS, mobile-first, světlý čitelný design. Bez build kroku.

## Data

Kanonickým zdrojem jsou **celoroční kumulativní přehledy Policie ČR** (prosincové /
plné roky). Dvě éry s odlišným formátem Excelu byly sjednoceny:

| Období | Formát | Poznámka |
|--------|--------|----------|
| 2008–2009 | `.xls` (listy `vusc_*`) | nejstarší kódování, objasněno ve sloupci 4 |
| 2010–2015 | `.xls` (listy `a_I*`) | objasněno ve sloupci 6 |
| 2016–2025 | `.xlsx` (listy dle krajů) | nová metodika evidence |

**Metodický zlom 2016:** Policie ČR změnila způsob sběru dat, proto roky před a po
nejsou zcela přesně srovnatelné (v grafech vyznačeno). Dlouhodobý sestupný trend je
přesto jednoznačný v obou obdobích.

Sledovaná metrika: **evidované (zjištěné) trestné činy** podle takticko-statistické
klasifikace (TSK). Přepočty na 100 000 obyvatel jsou orientační (počet obyvatel dle ČSÚ).

### Struktura složky `data/`

```
data/
├── raw/            # 18 kanonických celoročních souborů (2008.xls … 2025.xlsx)
├── monthly/YYYY/   # kompletní zrcadlo VŠECH měsíčních souborů z webu Policie ČR
├── crime-data.json # sjednocený výstup parseru (národní + krajská data)
└── manifest.tsv    # seznam všech stažených souborů + stav stažení
```

Data se generují znovu příkazem:

```bash
python3 scripts/parse.py   # vyžaduje openpyxl a xlrd
```

## Zdroje

- [Statistické přehledy kriminality — Policie ČR](https://policie.gov.cz/statistiky-kriminalita.aspx)
- [Mapa kriminality — Policie ČR](https://kriminalita.policie.gov.cz/)
- [Kriminalita — ČSÚ](https://csu.gov.cz/kriminalita)
- [Počet obyvatel — ČSÚ](https://csu.gov.cz/obyvatelstvo)

Vzdělávací, nekomerční účel.
