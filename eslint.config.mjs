import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Fronteras entre capas, verificadas por el lint.
 *
 * La arquitectura está descrita en `docs/arquitectura.md`, pero una regla que
 * solo vive en un `.md` se viola sola: alcanza con un agente apurado o con un
 * copy-paste. Acá están las mismas fronteras escritas como error de lint, que
 * es lo único que las hace ciertas.
 *
 * Cada zona declara qué NO puede importar. Si una regla te molesta, la
 * discusión es si la frontera está bien puesta — no si conviene agregar una
 * excepción. Hoy no hay ninguna: el repo cumple todas sin `eslint-disable`.
 */

/** Dominio puro: parseo, categorización y métricas. Funciones y datos, nada más. */
const DOMINIO = ["src/lib/ingest/**", "src/lib/categorize/**", "src/lib/analisis/**"];
/** Todo lo que dibuja: páginas y componentes. */
const UI = ["src/components/**", "src/app/**"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    name: "plata/dominio-puro",
    files: DOMINIO,
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {
        paths: [
          { name: "react", message: "El dominio no renderiza. Si necesitás un hook, va en un componente o en DatosContext." },
          { name: "react-dom", message: "El dominio no renderiza." },
          { name: "dexie", message: "Solo `src/lib/db` habla con IndexedDB. El dominio recibe los datos por parámetro." },
        ],
        patterns: [
          {
            group: ["@/lib/db/repo", "**/db/repo"],
            message: "El dominio no lee ni escribe la base: recibe los movimientos por parámetro y devuelve el cálculo. Así se puede testear sin navegador (y por eso hay 160 tests sin mocks).",
          },
          {
            group: ["@/lib/nube/*", "**/nube/*"],
            message: "El dominio no sabe que existe Drive.",
          },
          {
            group: ["@/components/*", "**/components/*", "@/app/*", "next/*"],
            message: "El dominio no conoce la UI. La dependencia va en un solo sentido: UI → dominio.",
          },
          {
            group: ["@/lib/DatosContext", "**/DatosContext"],
            message: "El contexto orquesta al dominio, no al revés.",
          },
        ],
      }],
    },
  },

  {
    name: "plata/datos",
    files: ["src/lib/db/**", "src/lib/nube/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@/components/*", "**/components/*", "@/app/*", "next/*"],
            message: "La capa de datos no conoce la UI.",
          },
          {
            group: ["@/lib/analisis/*", "**/analisis/*"],
            message: "Guardar no es analizar. Si una consulta necesita una métrica, el cálculo se hace arriba (DatosContext o la página), sobre lo que el repo devolvió.",
          },
        ],
      }],
    },
  },

  {
    name: "plata/ui",
    files: UI,
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {
        paths: [
          { name: "dexie", message: "La UI nunca abre la base. Leé del contexto (`useDatos`) y escribí por `@/lib/db/repo`." },
          { name: "xlsx", message: "El parseo del Excel vive en `src/lib/ingest`. La UI le pasa el File y muestra el resultado." },
        ],
        patterns: [
          {
            group: ["@/lib/db/esquema", "**/db/esquema"],
            allowTypeImports: true,
            message: "De `db/esquema` la UI solo puede sacar TIPOS (`import type`). Los valores y la instancia de Dexie se usan a través de `@/lib/db/repo`.",
          },
        ],
      }],
    },
  },

  {
    name: "plata/ui-primitivas",
    files: ["src/components/ui/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@/lib/DatosContext", "**/DatosContext", "@/lib/db/*", "**/db/*"],
            message: "Las primitivas (Boton, Card, Tooltip…) no saben de finanzas: reciben props y dibujan. Un botón que lee el contexto no se puede reusar.",
          },
        ],
      }],
    },
  },

  {
    name: "plata/plata",
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      /**
       * El bug de plata más caro del repo, ya documentado en `numero.ts`:
       * `parseFloat("1.234,56")` devuelve 1.234 — mil veces menos — y no tira
       * error. Todo importe entra por `parseImporteAR()`.
       */
      "no-restricted-globals": ["error", {
        name: "parseFloat",
        message: "Los importes del banco vienen en formato argentino: parseFloat(\"1.234,56\") = 1.234. Usá parseImporteAR() de @/lib/ingest/numero.",
      }],
      "no-restricted-properties": ["error", {
        object: "Number",
        property: "parseFloat",
        message: "Igual que parseFloat: usá parseImporteAR() de @/lib/ingest/numero.",
      }],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
