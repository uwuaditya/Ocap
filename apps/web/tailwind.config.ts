import type { Config } from "tailwindcss"
import { tailwindThemeExtend } from "../../packages/ui/src/tokens"

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: { ...tailwindThemeExtend },
  },
  plugins: [],
} satisfies Config
