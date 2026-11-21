import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Teach tailwind-merge the design system's type scale (app/globals.css).
// Note: text-xl is redefined as GOV.UK's 48px heading size.
// Without this it reads `text-small` as a text colour and drops a real
// colour class like `text-brand-foreground` when both are present.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["xl", "l", "m", "body", "small"] },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
