import { useLayoutEffect } from "react";

const canUseDOM = !!(
  typeof window !== "undefined" &&
  window.document &&
  window.document.createElement
);

const useLayoutEffectOverride = canUseDOM ? useLayoutEffect : () => undefined;

function postMessageNoOp<O>(_msg: O): void {
  return undefined;
}

export { canUseDOM, useLayoutEffectOverride, postMessageNoOp };
