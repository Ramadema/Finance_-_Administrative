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
 *
 * Ojo al editar: `no-restricted-imports` se reemplaza entero por zona (no se
 * suma). Si dos bloques alcanzan el mismo archivo, gana el último y el otro
 * desaparece en silencio. Por eso cada zona lista TODAS sus restricciones.
 */

/** Dominio puro: parseo, categorización y métricas. Funciones y datos, nada más. */
const DOMINIO = ["src/lib/ingest/**", "src/lib/categorize/**", "src/lib/analisis/**"];
/** Todo lo que dibuja: páginas y componentes. */
const UI = ["src/components/**", "src/app/**"];

const SIN_REACT = [
  { name: "react", message: "Esta capa no renderiza. Si necesitás un hook, va en un componente o en DatosContext." },
  { name: "react-dom", message: "Esta capa no renderiza." },
];
const SIN_DEXIE = { name: "dexie", message: "Solo `src/lib/db` habla con IndexedDB. Las demás capas reciben los datos por parámetro o pasan por `db/repo`." };
const SIN_UI = {
  group: ["@/components/*", "**/components/*", "@/app/*", "next/*"],
  message: "Esta capa no conoce la UI. La dependencia va en un solo sentido: UI → dominio.",
};
const SIN_CONTEXTO = {
  group: ["@/lib/DatosContext", "**/DatosContext"],
  message: "El contexto orquesta a las capas de abajo, no al revés.",
};
const SIN_NUBE = { group: ["@/lib/nube/*", "**/nube/*"], message: "Esta capa no sabe que existe Drive." };
const SIN_REPO = {
  group: ["@/lib/db/repo", "**/db/repo"],
  message: "Esta capa no lee ni escribe la base: recibe los movimientos por parámetro y devuelve el cálculo. Así se testea sin navegador y sin mocks.",
};
const SIN_SDK_DE_MODELO = {
  group: ["@anthropic-ai/*"],
  message: "Solo `src/lib/ia/proveedores` habla con un modelo. El resto de la app usa `preguntar()` de `@/lib/ia` y no sabe qué proveedor hay atrás.",
};
const SIN_IA = {
  group: ["@/lib/ia", "@/lib/ia/**", "**/lib/ia/**"],
  message: "El agente usa al dominio, no al revés: si el cálculo necesitara al modelo, dejaría de ser verificable.",
};
const SOLO_INDEX_DE_IA = {
  group: ["@/lib/ia/**", "**/lib/ia/**"],
  message: "De `lib/ia` se importa solo su `index.ts` (`@/lib/ia`). Lo demás es interno del agente.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    name: "plata/dominio-puro",
    files: DOMINIO,
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {
        paths: [...SIN_REACT, SIN_DEXIE],
        patterns: [SIN_REPO, SIN_NUBE, SIN_UI, SIN_CONTEXTO, SIN_IA, SIN_SDK_DE_MODELO],
      }],
    },
  },

  {
    // El agente: usa al dominio como cualquier otro consumidor, pero es la única
    // capa autorizada a hablar con un modelo. Mismas prohibiciones que el dominio,
    // salvo el SDK.
    name: "plata/ia",
    files: ["src/lib/ia/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {
        paths: [...SIN_REACT, SIN_DEXIE],
        patterns: [SIN_REPO, SIN_NUBE, SIN_UI, SIN_CONTEXTO],
      }],
    },
  },

  {
    name: "plata/datos",
    files: ["src/lib/db/**", "src/lib/nube/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {
        patterns: [
          SIN_UI,
          {
            group: ["@/lib/analisis/*", "**/analisis/*"],
            message: "Guardar no es analizar. Si una consulta necesita una métrica, el cálculo se hace arriba (DatosContext o la página), sobre lo que el repo devolvió.",
          },
          SIN_IA,
          SIN_SDK_DE_MODELO,
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
          SOLO_INDEX_DE_IA,
          SIN_SDK_DE_MODELO,
        ],
      }],
    },
  },

  {
    // El único código de servidor: el proxy al modelo. No tiene navegador ni base:
    // no puede tocar Dexie, el contexto, la nube ni componentes. Sí el adaptador
    // de Anthropic, porque para eso existe. Va DESPUÉS de "plata/ui" porque
    // `src/app/**` también lo alcanza y acá gana el último.
    name: "plata/servidor",
    files: ["src/app/api/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {
        paths: [...SIN_REACT, SIN_DEXIE],
        patterns: [
          SIN_REPO, SIN_NUBE, SIN_CONTEXTO,
          { group: ["@/components/*", "**/components/*"], message: "El servidor no renderiza." },
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
            group: ["@/lib/DatosContext", "**/DatosContext", "@/lib/db/*", "**/db/*", "@/lib/ia", "@/lib/ia/**"],
            message: "Las primitivas (Boton, Card, Tooltip…) no saben de finanzas: reciben props y dibujan. Un botón que lee el contexto no se puede reusar.",
          },
          SIN_SDK_DE_MODELO,
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
