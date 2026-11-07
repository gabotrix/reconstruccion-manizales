# Reconstrucción de Manizales · información pública

La página pública de la reconstrucción de Manizales después del sismo del 10 de agosto de 2026. Una alianza de la
Alcaldía de Manizales, Infimanizales y Camacol Regional Caldas.

Es una página estática:
- `index.html`, `css/`, `js/` e `img/`;
- dos archivos de cifras sumadas, `datos/cifras.json` y `datos/comunas.json`, que se actualizan cada día.

No tiene servidor ni base de datos. No se conecta con ningún sistema: su política de seguridad solo le deja leer sus
propios archivos. Las cifras no contienen nombres, direcciones, números prediales ni ningún dato que identifique a una
persona o una vivienda (Ley 1581 de 2012).

Para verla en un equipo: `python -m http.server 8992` en esta carpeta y abrir `http://127.0.0.1:8992`.
