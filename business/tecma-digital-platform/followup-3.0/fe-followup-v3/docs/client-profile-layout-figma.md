# Misure layout Scheda Cliente (Figma FW-CROSS Mockup)

Fonte: [Figma node 4351:21787](https://www.figma.com/design/DfCSn1Kyi1ChnjWfLq82Bt/branch/V2A971keLPlKYaX5vvXS74/FW-CROSS-%7C-MOCKUP?node-id=4351-21787)

## Contenitore pagina (Content Container)

| Proprietà | Valore | Note |
|-----------|--------|------|
| Padding top | 40px | `pt-[40px]` |
| Padding orizzontale | 40px | `px-[40px]` |
| Gap tra blocchi verticali | 32px | es. tra breadcrumb e corpo |
| Border-radius top-left | 4px | `rounded-tl-[var(--values/border-radius/external,4px)]` |

## Griglia a due colonne (Profile and Info Container)

| Proprietà | Valore | Note |
|-----------|--------|------|
| Gap tra colonna sx e main | 24px | `gap-[24px]` |
| Larghezza spalla sinistra | 512px | `w-[512px]` (fissa) |
| Area main | 1fr / 1048px | nel mockup `w-[1048px]`; in app usare `min-w-0 flex-1` |

## Spalla sinistra (Profile Container)

| Proprietà | Valore | Note |
|-----------|--------|------|
| Larghezza | 512px | |
| Gap tra card | 16px | `gap-[16px]` |
| Padding bottom container | 24px | `pb-[24px]` |

### Card spalla (Profile Details, Key info, Notes)

| Proprietà | Valore | Note |
|-----------|--------|------|
| Padding | 24px | `p-[24px]` |
| Gap interno (header/body) | 16px | `gap-[16px]` |
| Border-radius | 4px | `rounded-[4px]` |
| Shadow | 2px 2px 8px 4px rgba(223,225,230,0.25) | `shadow-[2px_2px_8px_4px_rgba(223,225,230,0.25)]` |
| Background | white | `bg-[var(--colors/neutral/general,white)]` |

### Profile Details (prima card) – gap tra avatar/info e campi

| Proprietà | Valore |
|-----------|--------|
| Gap tra sezioni | 32px |

## Area main (Overview / tab content)

| Proprietà | Valore | Note |
|-----------|--------|------|
| Gap tra tab group e contenuto | 32px | |
| Tab button padding | 24px orizzontale, 10px verticale | `px-[24px] py-[10px]` |
| Gap tra tab | 0 (bordi condivisi) | |
| Card/accordion padding | 24px | `p-[24px]` |
| Gap tra card Overview | 16px | `gap-[16px]` |
| Border-radius card | 4px | |
| Shadow card | 2px 2px 8px 4px rgba(223,225,230,0.25) | |

## Riga breadcrumb / titolo

| Proprietà | Valore |
|-----------|--------|
| Gap tra Back e titolo e menu | 16px (tra elementi) |
| Titolo: gap interno | 32px |
| Back button: padding | 24px px, 10px py, gap 8px |

## Token Figma → Tailwind/CSS

- `--spacing/s` = 16px  
- `--spacing/m` = 24px  
- `--spacing/2xl` = 48px  
- `--values/border-radius/element` = 2px  
- `--values/border-radius/external` = 4px  
