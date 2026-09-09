# Configurar Google Sheets como base compartida

Esta configuración se realiza una sola vez. La web seguirá alojada gratis en GitHub Pages y todos los dispositivos leerán y escribirán en la misma hoja de Google.

## Antes de empezar

- Usa una hoja de cálculo nueva y vacía.
- Elige un PIN de edición de al menos 8 caracteres. No lo publiques en GitHub.
- Solo quien vaya a guardar resultados necesita conocer el PIN. El resto del staff podrá consultar sin iniciar sesión.

## 1. Crear y preparar la hoja

1. Crea una hoja nueva en Google Sheets, por ejemplo `Eibar Femenino - Datos temporada`.
2. Dentro de esa hoja abre **Extensiones → Apps Script**.
3. Borra el contenido que aparezca en el editor.
4. Abre el archivo `google-apps-script/Code.gs` de este proyecto, copia todo y pégalo en Apps Script.
5. En la parte superior cambia solo esta línea:

   ```javascript
   const EDITOR_PIN = "CAMBIA-ESTE-PIN";
   ```

   Sustituye el texto entre comillas por tu PIN. No uses comillas dentro del PIN.
6. Pulsa **Guardar proyecto** y ponle, por ejemplo, `Eibar Staff Backend`.
7. En el desplegable de funciones selecciona `inicializarEibar` y pulsa **Ejecutar**.
8. Google pedirá autorización. Elige tu cuenta y concede acceso a la hoja. Si muestra que la aplicación no está verificada, entra en **Configuración avanzada** y continúa únicamente si reconoces que el proyecto es el que acabas de crear tú.
9. Vuelve a la hoja. Deben aparecer las pestañas `EQUIPOS`, `PARTIDOS` y `CONFIG`. Todavía estarán sin datos de temporada.

## 2. Publicar el conector

1. En Apps Script pulsa **Implementar → Nueva implementación**.
2. En **Seleccionar tipo**, elige **Aplicación web**.
3. Configura:
   - **Ejecutar como:** `Yo`.
   - **Quién tiene acceso:** `Cualquiera`.
4. Pulsa **Implementar** y copia la URL que termina en `/exec`.

Si tu cuenta de trabajo no ofrece la opción `Cualquiera`, la organización la ha restringido. En ese caso utiliza una cuenta personal de Google para esta hoja o pide al administrador que permita aplicaciones web accesibles mediante enlace.

## 3. Conectar la web

1. Abre el dashboard publicado en GitHub Pages.
2. Entra en **Modelo y datos → Google Sheets**.
3. Pega la URL `/exec` y pulsa **Conectar**.
4. La web indicará que la hoja está vacía. Introduce el PIN y pulsa **Crear datos iniciales**.
5. Comprueba en Google Sheets que se han rellenado 16 equipos, 240 partidos y la configuración.
6. En el mismo panel pulsa **Copiar enlace del staff**. Ese enlace ya contiene el identificador de la hoja y carga los datos compartidos en cualquier dispositivo.

## Uso cotidiano

- Quien registra marcadores abre el enlace, introduce el PIN en **Modelo y datos** y guarda cada partido.
- El PIN solo queda en la sesión del navegador. Al cerrar el navegador puede ser necesario escribirlo de nuevo.
- Quien consulta abre el mismo enlace y no necesita PIN.
- Al abrir o recargar la página se lee el estado más reciente de la hoja.
- Si otra sesión guardó antes, la web evita sobrescribirla y pide recargar.
- Sigue siendo recomendable usar **Exportar temporada** de vez en cuando como copia JSON.

## Si cambias el script o el PIN

1. Modifica el código o `EDITOR_PIN` en Apps Script.
2. Si cambiaste el PIN, ejecuta otra vez `inicializarEibar`; no borra los datos.
3. Abre **Implementar → Gestionar implementaciones**, edita la implementación y selecciona **Nueva versión**.
4. Manteniendo la misma implementación, la URL `/exec` seguirá siendo válida.

## Seguridad práctica

La URL compartida permite leer la clasificación, marcadores y notas. No guardes información médica, personal o especialmente sensible en las notas técnicas. Las escrituras exigen el PIN, cuyo resumen cifrado queda en Apps Script. El PIN en claro no se guarda en la hoja ni en GitHub.
