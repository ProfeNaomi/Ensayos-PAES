# 🎓 PAES Tutor IA - Plataforma de Ensayos Premium

¡Bienvenido a **PAES Tutor IA**! Esta es una aplicación web de última generación diseñada para ayudar a los estudiantes chilenos a prepararse para la **Prueba de Acceso a la Educación Superior (PAES)** de Matemática (M1 y M2), utilizando inteligencia artificial avanzada para proporcionar tutoría personalizada y detallada.

## ✨ Características Principales

- **☁️ Repositorio en la Nube (Firebase):** Los ensayos ahora se almacenan de forma centralizada en Firestore. Los profesores pueden subir materiales y cualquier estudiante puede acceder a ellos.
- **🤖 Tutoría Socrática con IA:** Integración con **Gemini 1.5 Pro y Flash**. El tutor no solo da respuestas, sino que guía al estudiante paso a paso mediante pistas y preguntas reflexivas, adaptándose al estilo de aprendizaje chileno.
- **💎 Interfaz Premium:** Experiencia de usuario ultra pulida con animaciones fluidas (`Framer Motion`), tipografía moderna y feedback visual inmediato.
- **🔐 Acceso Docente:** Sistema de autenticación seguro para que solo los profesores autorizados puedan gestionar (subir/eliminar) los ensayos.
- **📊 Extracción Inteligente:** Capacidad para subir ensayos en PDF y dejar que la IA extraiga automáticamente las preguntas, figuras y soluciones.

## 🛠️ Tecnologías Utilizadas

- **Frontend:** React + Vite + TypeScript.
- **Estilos:** Tailwind CSS v4.
- **Animaciones:** Framer Motion.
- **Backend:** Firebase (Firestore & Authentication).
- **IA:** Google Gemini (Generative AI SDK).
- **Matemáticas:** KaTeX para renderizado de fórmulas LaTeX.

## 🚀 Cómo Empezar

### Requisitos Previos

- Node.js instalado.
- Una cuenta de Firebase configurada.
- API Key de Google AI Studio (Gemini).

### Instalación

1.  **Clonar este repositorio** (o descargar los archivos).
2.  **Instalar dependencias:**
    ```bash
    npm install
    ```
3.  **Configurar Variables de Entorno:**
    Crea un archivo `.env` en la raíz con lo siguiente:
    ```env
    VITE_FIREBASE_API_KEY=tu_api_key
    VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain
    VITE_FIREBASE_PROJECT_ID=appmatematicaescolar
    VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
    VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
    VITE_FIREBASE_APP_ID=tu_app_id
    GEMINI_API_KEY=tu_gemini_api_key
    ```
4.  **Ejecutar en desarrollo:**
    ```bash
    npm run dev
    ```

## 📦 Despliegue

La aplicación está lista para ser desplegada en plataformas como **Vercel** o **Firebase Hosting**. Asegúrate de configurar las variables de entorno en el panel de control de tu proveedor de hosting.

---
*Desarrollado con ❤️ para mejorar la educación matemática en Chile.*
