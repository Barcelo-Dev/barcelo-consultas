import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: {
    colors: { barcelo: { bright:"#309dba", teal:"#1f7d9c", deep:"#2f5c78", ink:"#14323d", gray:"#8e9091", gold:"#c99a3f", cream:"#f6f4ef" } },
    fontFamily: { display:["var(--font-display)","Georgia","serif"], sans:["var(--font-sans)","system-ui","sans-serif"] },
  } },
  plugins: [],
};
export default config;
