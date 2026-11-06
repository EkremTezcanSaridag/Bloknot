/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Paylaşımlı Groq proxy'sinin Cloudflare Worker adresi. */
  readonly VITE_GROQ_PROXY_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
