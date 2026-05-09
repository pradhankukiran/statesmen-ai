// Default fallback for the implicit `children` slot, paired with the @modal
// parallel slot in app/layout.tsx.
//
// Once any parallel slot exists at the root, Next.js asks the implicit
// children slot to declare its own "render nothing" fallback for soft
// navigations where only the modal slot has matched a deeper segment.
// Without this file, those navigations can throw a 404 on otherwise valid
// URLs. Returning null is the canonical "do nothing" branch — direct loads
// still hit the regular page.tsx tree as today.
export default function Default() {
  return null;
}
