import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        barcelo: {
          bright: "#309dba", // teal claro del icono
          teal: "#1f7d9c",   // teal medio (botones/acentos)
          deep: "#2f5c78",   // teal oscuro del icono
          ink: "#14323d",    // texto oscuro
          gray: "#8e9091",   // gris del logotipo
          gold: "#c99a3f",   // acento dorado del cupón (recompensa)
          cream: "#f6f4ef",  // fondo claro
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
