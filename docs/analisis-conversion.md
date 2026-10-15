# Análisis de Hipnos_AR_Unity y correspondencia web

Se inventariaron los 122 archivos del proyecto de trabajo, con hash SHA256 por archivo. El ZIP recuperado contenía 102 entradas completas, todas idénticas a la copia de trabajo, y una entrada truncada de `Hub_Source.glb`; no contenía el directorio central final del ZIP. La conversión utilizó la copia completa de los activos y código que habían originado ese mismo paquete. Los hashes de ambos GLB coinciden con `Documentation/model_conversion.json` del proyecto Unity. No se sustituyó el producto por otro modelo.

La versión web completa usa el GLB Premium v3 del que se extrajeron los GLB separados de Unity. El SHA256 de ese origen es `f5625fda29566a6a1497844224fc3395f5f93694fc8854d54e2e8b1d5e804df1`; el manifiesto real `assets/models/model.json` contiene la autoridad para verificar los bytes del archivo, por si cambia en una revisión. Se conservan mallas, normales, UV, índices, PBR y recursos de acabado del visor original. El archivo se comprime sin pérdida para transporte. No se aplica reducción de polígonos.

## Archivos y componentes analizados

| Proyecto Unity | Adaptación entregada |
|---|---|
| Bootstrap, escena, XR Origin, paquetes ARFoundation/ARCore/ARKit | Escena Three.js y controles OrbitControls. La AR de iPhone se delega a Quick Look con USDZ. |
| ModelAssets, catálogo y GLB | Loader GLB original, selector de tamaños, PBR y exportación de componentes Unity a USDZ. |
| SpatialSession y MattressCalibration | La web no reproduce la calibración nativa. Quick Look ofrece colocación manual sobre un plano; se informa el límite y se mantiene el tamaño del modelo. |
| HipnosApplication | Estados de vista general, hub, microclimas, capas, agua y controles de componentes. |
| HydraulicLinks | Código original de dos circuitos, tubos, suministro/retorno, flechas y animación. Conexiones posteriores adaptadas al tamaño y desplazamiento del hub. |
| ThermalOverlay | Malla térmica superpuesta compartiendo geometría original, 16–28 °C independientes y color gradual. |
| AmbientLighting, ContactShadows | Luces, sombras, entorno y calidad automática del visor Premium. En AR, el visor del sistema administra la presentación. |
| HipnosUI y Raleway | Interfaz adaptable en español, tipografías locales, ayuda y componentes accesibles. |
| ARPhotoCapture y plugins Android/iOS | Captura del visor WebGL con descarga o Web Share; captura AR mediante el visor del iPhone. |
| Shaders Water/Thermal/ShadowCatcher y DetailMaps | Shaders y texturas originales del visor Three.js. Materiales USD Preview Surface para Quick Look. |
| Editor BuildProject, IOSPermissions, configuración de plataformas | No son necesarios para un sitio estático. Se entregan HTML, JS compilado, manifiesto PWA, service worker y `.nojekyll`. |
| Tests/Editor y Tools | Pruebas web de geometría y comportamiento; conversión y validación USD. Resultados JSON incluidos. |
| Documentación, licencias, metadatos Unity | Guía Windows/iPhone, licencias aplicables e inventario de origen. `.meta` y configuración nativa no son recursos del sitio. |

## Diferencias de alcance

- La simulación térmica es visual: no gobierna el hardware ni estima físicamente el calentamiento/enfriamiento.
- Los tamaños comerciales son transformaciones horizontales del modelo original de 180 × 206 cm. En `Original` no se modifica la escala. Se conservan todos los vértices y acabados; las variantes adaptan ancho/largo y las mangueras. No son CAD específicos de fabricación.
- No había una malla de control remoto en ninguno de los GLB. La web incorpora una representación funcional explícitamente identificada; su pantalla responde a los controles térmicos.
- Quick Look ejecuta colocación AR y presentación del USDZ, no los controles ni shaders JavaScript. La web conserva las funciones interactivas al salir de AR. El despiece no se elimina del visor web.
- La AR permite ver el conjunto completo y también los componentes separados. El conjunto conserva la altura de referencia del original y no se calibra contra una cama real.
- Los anclajes nativos, la medición por cuatro esquinas, el seguimiento independiente de ambos componentes y la captura AR desde código Unity no están disponibles mediante Quick Look. Se sustituyen por colocación manual del visor del sistema y edición independiente del hub en la vista web. Esto está indicado en la interfaz y en la guía.

## Verificaciones

`validacion-funcional.json`: controles y escenas ejecutados en Node.js + DOM simulado, usando Three.js y las texturas reales. No corresponde a una prueba de navegador ni de GPU.

`validacion-usdz.json` y `validacion-usdz-conjunto.json`: lectura real de nueve USDZ, referencias, tipos de shader y geometría con OpenUSD. Ninguno produjo errores en la validación final. No equivalen a una prueba de cámara ni a la certificación del visor Apple.

`validacion-estatica.json`: vínculos locales, activos PWA, JavaScript, empaquetado, tamaño y referencias de archivos.

No había una herramienta de control de navegador habilitada para QA en el entorno. No se inició un navegador alternativo ni se afirmó haber probado un iPhone. La prueba física final queda pendiente después de publicar.

Las texturas de detalle se almacenan como WebP sin pérdida: se compararon píxel a píxel contra los PNG originales. Esta conversión reduce la descarga sin alterar los mapas. El GLB conserva sus texturas embebidas originales.
