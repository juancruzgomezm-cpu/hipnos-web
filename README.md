# Hipnos by Piero — experiencia web 3D y AR

Sitio estático listo para GitHub Pages. No requiere Unity, Mac, App Store, claves API, Node.js ni compilar en tu computadora. Incluye todos los recursos; no depende de una CDN para cargar el visor.

**Para publicar: descomprimí este paquete y subí su contenido, no el ZIP. `index.html` debe quedar en la raíz del repositorio.** La guía visual está en `guia.html` y puede abrirse con doble clic desde Windows.

## Publicar desde Windows, usando Chrome

1. Entrá en https://github.com e iniciá sesión. Si no tenés cuenta, creá una gratuita.
2. Arriba a la derecha, tocá **+ → New repository**.
3. Poné **hipnos-web** como nombre. Elegí **Public** para utilizar GitHub Pages con una cuenta gratuita. Activá **Add a README file** y tocá **Create repository**.
4. Dentro del repositorio, elegí **Add file → Upload files**.
5. En Windows, abrí la carpeta descomprimida que contiene `index.html`, `assets`, `manifest.webmanifest` y `sw.js`. Seleccioná el contenido de esa carpeta y arrastralo al área de carga de GitHub. No arrastres la carpeta contenedora ni el ZIP.
6. Esperá a que todos los archivos terminen de cargarse. Escribí **Publicar Hipnos web** y tocá **Commit changes**. Si GitHub interrumpe la carga, subí primero los archivos de la raíz y después cada carpeta. Conservá la estructura de carpetas. Todos los archivos preparados pesan menos de 25 MiB, y el paquete tiene menos de 100 archivos publicables.
7. Entrá en **Settings → Pages**. Dentro de **Build and deployment**, elegí **Source: Deploy from a branch**.
8. Seleccioná la rama **main**, la carpeta **/(root)** y tocá **Save**.
9. Esperá a que termine la publicación. La pestaña **Actions** permite ver el progreso. Volvé a **Settings → Pages** y copiá la dirección que aparece en **Your site is live at…**. Puede demorar varios minutos.
10. La dirección tendrá esta forma: **https://TUUSUARIO.github.io/hipnos-web/**. Es un ejemplo: usá la URL exacta que muestre tu repositorio.

El código está listo para publicar, pero este paquete no crea un repositorio ni publica una URL por sí solo. Los archivos del repositorio público se pueden descargar.

## Abrir en el iPhone y generar el QR

1. Abrí la URL pública en **Safari** y esperá la carga del modelo. La primera descarga del visor es de unos 48 MB. El sistema de AR se descarga únicamente al abrirlo.
2. En la experiencia, tocá **QR / Compartir**. En una página publicada el campo toma automáticamente la dirección del sitio.
3. Revisá que la dirección sea la de tu sitio. Tocá **Generar QR → Descargar QR**. También podés pegar una URL HTTPS distinta y generar su QR; no se envía a servicios externos.
4. Mostrá o imprimí el QR. En el iPhone, abrí **Cámara**, apuntá al código y tocá el enlace.
5. Si el enlace abre dentro de otra aplicación, elegí **Abrir en Safari**, especialmente para usar AR.

No se incluye un QR con una dirección ficticia. El QR definitivo se genera cuando ya existe tu URL pública.

## Agregar Hipnos a la pantalla de inicio

En Safari: **Compartir → Agregar a pantalla de inicio → Agregar**. Si aparece **Abrir como app web**, dejalo activado. Se agrega un ícono de Hipnos y la experiencia puede abrirse como una aplicación web. No instala un IPA ni requiere Apple Developer.

En **? → Guardar visor sin conexión** podés guardar el visor y sus recursos después de la primera carga. El guardado es opcional y muestra su progreso. El navegador puede eliminar esos datos si necesita espacio. Los archivos USDZ de AR se descargan por separado y no forman parte de ese guardado.

## Usar el visor

- Arrastrar: rotación libre de 360°. Pellizcar o rueda: zoom. Dos dedos o botón derecho: desplazar la cámara.
- **Interior del hub:** apertura reversible, selector de componentes, aislamiento de piezas y explicación de su función.
- **Microclimas:** dos ajustes independientes entre 16 y 28 °C, con cambios graduales de color. Es una demostración; no controla un dispositivo físico ni predice tiempos térmicos.
- **Capas del cover:** despiece y explicación de materiales.
- **Agua:** suministro y retorno por dos circuitos, pausa, velocidad visual, flechas y selección de lado.
- **Tu medida:** Dos plazas 140 × 190 cm, Queen 160 × 200 cm, King 200 × 200 cm y Original 180 × 206 cm.
- **Componentes:** mostrar/ocultar piezas, acercarse al control RF y desplazar y girar el hub. Las mangueras se adaptan y siguen entrando por detrás de la cama.
- Luna/sol: iluminación nocturna o diurna. Calidad automática: limita resolución y posprocesado en pantallas pequeñas sin reducir la geometría original.
- **? → Guardar imagen 3D:** descarga o comparte una captura del visor. Para fotografiar la AR usá las opciones del visor de Apple o una captura del iPhone.

## Realidad aumentada en Safari

1. Seleccioná el tamaño en el visor web.
2. Tocá **Ver en mi espacio**.
3. Elegí **Cover + hub**, **Cubrecolchón** o **Hub**.
4. Tocá la imagen **Ver en mi espacio**. Safari abre **Quick Look**, el visor AR del sistema.
5. Elegí la vista **AR** y apuntá a una superficie plana con buena luz. Para el conjunto usá el piso junto a la cama. Mové y girá el producto dentro del visor.
6. Cerrá Quick Look para volver a los controles interactivos de la web.

Se incluyen nueve archivos USDZ: cuatro conjuntos, cuatro covers y el hub. Su geometría y materiales proceden de los modelos existentes. Los modelos se expresan en metros y el enlace solicita conservar el tamaño.

**Límites concretos de la AR:** Quick Look no ejecuta la interfaz JavaScript del sitio. Las temperaturas, el agua en movimiento, el aislamiento de piezas y el despiece se utilizan en la web. Dentro de Quick Look, el conjunto se mueve como una sola unidad; también se pueden abrir cover y hub por separado. No se trasladó la calibración nativa de cuatro esquinas, la detección de altura del colchón ni los anclajes independientes de Unity. El conjunto conserva la altura original del modelo (aproximadamente 72 cm de apoyo del cover), que puede no coincidir con tu cama. El cover individual se apoya según el volumen que interpreta Quick Look y no reconoce automáticamente el colchón. La luz y los materiales pueden verse diferentes entre WebGL y Quick Look.

En navegadores que no anuncian compatibilidad con Quick Look se indica el límite y se ofrece la descarga del USDZ. El visor 3D sigue siendo utilizable en navegadores modernos con WebGL 2; no se presenta como AR.

## Qué se reutilizó y qué se adaptó

- El GLB del visor Premium v3 es el origen exacto de los componentes incluidos en el proyecto Unity. Se conservó íntegro y se comprueba su SHA256. Se entrega comprimido en tres partes que la web recompone automáticamente; no es un modelo simplificado.
- Se reutilizaron el acabado textil, las costuras, el entorno, las cámaras, las luces y el código de exploración del visor original. También se conservaron su animación de apertura, circulación y selección de componentes.
- Los GLB `Cover_Source` y `Hub_Source` del proyecto Unity se convirtieron a USDZ, con los materiales PBR correspondientes, para la AR. Los acabados particulares del shader web no existen como shaders JavaScript dentro de Quick Look.
- El catálogo de Unity incluía un único cover de 180 × 206 cm. Los tres tamaños comerciales se obtienen mediante una adaptación horizontal reversible del mismo modelo; el hub y el control mantienen sus dimensiones. No se presentan como tres modelos CAD originales ni como mediciones de un producto fabricado.
- El proyecto no contenía un modelo del control remoto. Se agregó una representación funcional 3D identificada como tal, con la pantalla vinculada a las temperaturas. No reemplaza ninguna pieza existente.
- Se agregó una PWA, captura de imagen 3D, controles de componentes, QR local y ayuda de publicación.

## Validación y límites de la entrega

Se ejecutaron pruebas automatizadas en Node.js con Three.js y DOM simulado: carga y hash del GLB, texturas, límites térmicos, independencia de lados, agua, despiece, aislamiento, dimensiones, conexiones posteriores, conservación de buffers, movimiento del hub, enlaces AR y QR. Los USDZ se abrieron y validaron con OpenUSD; se comprobaron también su empaquetado y referencias.

**No se ejecutó el render en un navegador de este entorno ni se probó físicamente en un iPhone.** La herramienta de navegador requerida por el entorno no estaba disponible. Las pruebas de DOM y geometría no sustituyen esa comprobación. La compatibilidad se implementó con WebGL 2 y Quick Look; la prueba final de imagen, rendimiento, Safari y cámara debe realizarse con la URL publicada. Los resultados concretos se incluyen en `docs/`.

El ZIP Unity disponible estaba truncado al final. Se recuperaron 102 entradas coincidentes con la copia de trabajo; se utilizaron los activos y fuentes completos conservados del mismo proyecto. La incidencia y el inventario están documentados en `docs/analisis-conversion.md`. No se sobrescribió el proyecto Unity.

## Si aparece un problema

- **Abrí index.html y no carga:** el visor necesita una dirección web para solicitar sus recursos. Abrí la URL de GitHub Pages. `guia.html` sí se puede abrir directamente para consultar estos pasos.
- **GitHub muestra 404:** verificá que `index.html` esté en la raíz, que la fuente sea `main / (root)` y que la publicación haya terminado.
- **Falta una parte del modelo:** revisá que estén los tres archivos `assets/models/hipnos.glb.gz.part1`, `part2` y `part3`.
- **La AR descarga un archivo:** abrí en Safari, fuera del navegador interno de otra app. Confirmá que `assets/ar/` se haya publicado completo.
- **La imagen tarda o se traba:** dejá calidad automática, pausá la circulación del agua y cerrá otras pestañas. La geometría original se conservó para mantener el detalle.
- **No aparece Agregar a inicio:** buscá la acción en el menú Compartir de Safari; puede ser necesario editar la lista de acciones.

## Actualizar el sitio

Subí los archivos modificados y confirmá los cambios en GitHub. Pages volverá a publicar. Si se cambia código en una versión futura, hay que cambiar también la versión de caché de `sw.js` para que una PWA instalada reciba el nuevo conjunto de recursos. La carpeta `src/` contiene las fuentes para futuras modificaciones; `assets/app.js` ya está compilado y listo para usar.

## Fuentes oficiales

- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- Subir archivos desde el navegador (25 MiB por archivo, 100 archivos por carga): https://docs.github.com/es/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- Quick Look y enlaces AR de Safari: https://webkit.org/blog/8421/viewing-augmented-reality-assets-in-safari-for-ios/
- Quick Look de Apple: https://developer.apple.com/augmented-reality/quick-look/
- Agregar una web como app en iPhone: https://support.apple.com/guide/iphone/iphea86e5236/ios
