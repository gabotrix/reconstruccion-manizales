# Reconstrucción de Manizales · información pública

La página pública del Plan de Recuperación Manizales después del sismo del 10 de agosto de 2026, de la Alcaldía de
Manizales.

## La página informativa (raíz)

- `index.html`, `css/`, `js/` e `img/`.
- Tres archivos de cifras sumadas en `datos/`:
  - `cifras.json`: el corte diario de la plataforma (visitas, resultados por comuna, demoliciones, predios afectados).
  - `comunas.json`: los contornos de las comunas para el mapa.
  - `arp.json`: lo que no trae el corte diario. Las asignaciones ARP (edificaciones y comercio), los comercios
    afectados, las cifras de cada paso del proceso y el detalle por comuna de las capas «ARP Reparación» y «ARP Comercio».
    Se edita a mano mientras no exista la función en vivo, y el corte diario no lo toca.

Las cifras no contienen nombres, direcciones, números prediales ni ningún dato que identifique a una persona o una
vivienda (Ley 1581 de 2012).

### Cifras en vivo

Si `datos/arp.json` trae `"en_vivo": "https://api.manizalesconstruye.camacolcaldas.com/functions/v1/cifras-publicas"`,
la página consulta esa dirección al abrir y cada 5 minutos, y sus cifras reemplazan a las de los archivos. Si falla,
quedan las del último corte. La política de seguridad de la página solo permite conectarse con ese servidor.

La función responde un GET público, sin sesión, con cifras sumadas y nada más:

```json
{
  "cifras": { "...": "lo mismo que datos/cifras.json" },
  "arp": {
    "corte": "2026-11-19T21:56:00Z",
    "afectados": { "comercios": 2000 },
    "asignaciones": { "edificaciones": { "n": 48, "valor": 757645391 }, "comercio": { "n": 56, "valor": 626824779 } },
    "pasos": { "visita": null, "valoracion": null, "socializados": null, "asignados": null, "entregados": null },
    "comunas": {
      "8": {
        "rep": { "n": 5, "valor": 80000000 },
        "com": { "n": 4, "valor": 20000000, "severidad": { "Severo": 1, "Leve o moderado": 2, "Básico": 1 } }
      }
    }
  }
}
```

- `cifras` y `arp` son opcionales: lo que falte se toma de los archivos.
- Un paso en `null` no se muestra. Cuando se publique, el número sale en la tarjeta de ese paso (también puede ser
  `{ "n": 120, "txt": "aportes entregados con resolución" }`).
- Mientras `comunas` venga vacío, la ficha del mapa dice que el detalle por comuna se está consolidando, y la tabla no
  muestra las columnas de ARP asignados.

## La ventanilla única (`ventanilla/`)

Ya no se enlaza desde la página (19-nov-2026: no se piden visitas por la web; la atención va por
`pqr@planrecuperacionmanizales.gov.co`). La carpeta sigue publicada en su dirección.

## Fotos

Las de `img/fotos/` son de uso libre; sus autores y licencias están en `img/fotos/CREDITOS.md` y en «Sobre estos datos»
(las de Wikimedia Commons lo exigen).

Para verla en un equipo: `python -m http.server 8992` en esta carpeta y abrir `http://127.0.0.1:8992`.
