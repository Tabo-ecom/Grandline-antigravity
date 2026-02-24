# Cómo Sincronizar tu Proyecto entre computadores

¡Sí, es totalmente posible! Aquí tienes la mejor estrategia para trabajar en GRAND LINE desde cualquier PC manteniendo a Antigravity sincronizado.

## 1. El Código Fuente (Git)
La forma más profesional es usar **GitHub**, **GitLab** o **Bitbucket**.
- **En tu PC actual**: Sube el código a un repositorio privado.
- **En el nuevo PC**: Clonas el repositorio.
- **Antigravity**: Cuando abras la carpeta en el nuevo computador, Antigravity escaneará los archivos y entenderá el proyecto de nuevo automáticamente.

## 2. Variables de Entorno (.env.local)
**¡IMPORTANTE!** Por seguridad, el archivo `.env.local` nunca se sube a GitHub (está en el `.gitignore`).
- Debes copiar manualmente el contenido de tu `.env.local` (donde están las llaves de Firebase que acabamos de poner) al nuevo computador.
- Sin esto, el proyecto no podrá conectarse a la base de datos.

## 3. El "Cerebro" de Antigravity (Opcional)
Antigravity guarda los planes de implementación y el historial de tareas en una carpeta oculta en tu usuario (`~/.gemini/antigravity/brain/...`).
- **Si NO mueves esta carpeta**: Al abrir el proyecto en el nuevo PC, Antigravity será como un "nuevo compañero" que llega a un proyecto existente: leerá el código y te ayudará, pero no tendrá el historial exacto de los chats anteriores.
- **Si SI quieres el historial**: Tendrías que copiar la carpeta de la ruta mencionada arriba. Sin embargo, usualmente con que Antigravity lea el código fuente es más que suficiente para seguir trabajando.

## Recomendación Paso a Paso:
1. Crea un repositorio **Privado** en GitHub.
2. Sube todo el código.
3. En el nuevo PC, instala **Antigravity** y clona el repo.
4. Crea un archivo `.env.local` en blanco y pega las credenciales de Firebase.
5. ¡Listo para seguir dándole órdenes a Antigravity!
