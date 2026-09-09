# Eibar Femenino · Staff

Aplicación en español para registrar los resultados de los 240 partidos de Liga F 2026/27 y seguir el objetivo de permanencia del Eibar.

## Qué incluye

- Dashboard con avance real hacia 31 puntos, probabilidad del objetivo conjunto, margen sobre descenso y proyección final.
- Clasificación completa calculada desde los marcadores y consulta hasta una jornada.
- 30 jornadas, ocho partidos por jornada, edición de ambos marcadores y notas técnicas. Un partido pendiente lleva ambos goles vacíos; 0–0 es un resultado válido.
- Rendimiento respecto a puntos esperados, rachas, porterías a cero y puntos por partido en casa y fuera.
- Dificultad y puntos esperados de los próximos rivales; escenarios de victoria, empate y derrota.
- Históricos y parámetros editables, exportación/importación de la temporada y restauración con confirmación.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub y sube el contenido de este proyecto a la rama `main`, incluyendo `.github/workflows/pages.yml`.
2. En **Settings → Pages → Build and deployment**, selecciona **GitHub Actions**.
3. Ejecuta el flujo **Publicar dashboard en GitHub Pages** desde **Actions**, o sube un cambio a `main`.
4. Abre el enlace que aparece al terminar el trabajo `deploy`.

La aplicación utiliza rutas relativas: funciona tanto en `usuario.github.io` como bajo `usuario.github.io/repositorio/`. No requiere claves API, cuenta de IA, servicios de pago ni llamadas externas para calcular.

**Almacenamiento en GitHub Pages:** al abrir la aplicación, pulsa **Activar guardado local**. Los resultados se conservan en ese navegador entre sesiones. No se sincronizan con otros dispositivos ni se guardan en el repositorio. Utiliza **Modelo y datos → Exportar temporada** para hacer copias y **Importar copia** para trasladarlas. Borrar los datos del navegador elimina esa copia local. No es un modo multiusuario.

Documentación oficial: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## Versión online con base de datos

La versión de Sites incluida en el proyecto guarda el estado en Cloudflare D1 mediante `/api/state`. Se publica con acceso privado y controles de revisión para evitar que dos sesiones sobrescriban cambios sin detectar el conflicto. No conecta la edición GitHub Pages con la base de datos automáticamente.

Si falla un guardado, los cambios permanecen en pantalla, se indica que no están guardados y se permite reintentar o exportarlos. No cierres la página sin exportar si el error continúa. Los borradores de marcador requieren pulsar **Guardar** en cada partido.

## Desarrollo

Node.js 22.13 o superior. Desde la raíz del proyecto:

```bash
npm ci
npm test
npm run build:pages
```

`pages-dist/` contiene la web estática compilada. Puede servirse con cualquier servidor HTTP estático. Abrir directamente el HTML con `file://` no es compatible con módulos JavaScript.

El archivo `vite.pages.config.ts` compila la entrada de `standalone-pages/`; la edición online usa `app/page.tsx`. Ambas reutilizan `components/staff-app.tsx` y `lib/engine.ts`.

## Datos y metodología

Calendario: 240 emparejamientos obtenidos de las páginas de jornadas de Liga F. Datos iniciales: las 16 actas de las jornadas 1 y 2. Comprobación: 9 de septiembre de 2026. No hay actualización automática desde la web; las novedades se introducen manualmente.

Fuentes:
- https://ligaf.es/resultados/primera_division_femenina/1/2027 (cambiar el número de jornada hasta 30)
- https://ligaf.es/clasificacion/primera_division_femenina/30/2026
- https://www.mundodeportivo.com/resultados/futbol/femenino/liga-f/clasificacion/2024-2025

El modelo estima fuerzas a partir de los puntos de las dos temporadas anteriores (70/30 por defecto), incorpora ventaja local, empates y una actualización moderada por resultado. Para Badalona se usan 39 puntos deportivos en 2025/26, antes de la sanción de tres puntos. Los ascendidos sin histórico comparable reciben como referencia la fuerza media del Eibar y Logroño de la última temporada, con mayor incertidumbre. Se pueden introducir otros puntos históricos como hipótesis.

Simula conjuntamente 6.000 finales de temporada: cada resultado reparte puntos entre ambos equipos. Las fuerzas varían en cada simulación y se utiliza una semilla fija para obtener el mismo resultado al mantener los datos. La horquilla mostrada contiene aproximadamente el 80 % de los puntos simulados; no es un intervalo de confianza calibrado.

El porcentaje realizado es `min(100, puntos actuales / meta × 100)`. La probabilidad conjunta exige `puntos Eibar >= meta` y al menos dos equipos con **menos puntos**. Los empates no se consideran favorables; por ello esta cifra es conservadora respecto a una permanencia que pudiera obtenerse por desempate. La clasificación visual se ordena provisionalmente por puntos, diferencia de goles y goles a favor. No sustituye el desempate oficial.

La dificultad se expresa como puntos esperados del partido: menos de 0,8, alta; entre 0,8 y 1,4, media; desde 1,4, menor. El rendimiento compara los puntos obtenidos con la expectativa previa. No se usan xG, lesiones ni valoraciones de fichajes. Los aplazados se procesan por jornada, no por fecha real. El modelo no se ha validado retrospectivamente y sus cifras son orientativas; no debe interpretarse la probabilidad como porcentaje ya asegurado.

## Copias y cambios de calendario

La exportación JSON contiene `version`, `season`, `teams`, `matches`, `settings` y `updatedAt`. Puede editarse para corregir emparejamientos y volver a importarse: se exigen 16 equipos, 30 jornadas, ocho partidos por jornada y una visita por cada pareja ordenada. No se admiten marcadores parciales, negativos, decimales ni mayores de 50. La importación sustituye la temporada después de una confirmación.

## Validación realizada

Pruebas de clasificación inicial, edición/corrección/borrado de resultados, integridad del calendario, importación, simulaciones reproducibles y cierre de temporada; pruebas de persistencia SQL, recuperación, conflicto de revisión y validación de API. Comprobación de TypeScript y compilación de ambas ediciones. No se ha realizado una prueba visual en navegador.
