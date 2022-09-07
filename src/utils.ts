import { useLayoutEffect } from "react";

/**
 * `chrome` will only have a value if the `externally_connectable` manifest property
 *  contains a match for the url we're running on:
 * [externally_connectable - Chrome Developers]
 * (https://developer.chrome.com/docs/extensions/mv3/manifest/externally_connectable/)
 *
 */
function doesFunctionalityExist() {
  return (
    (typeof chrome as unknown) !== undefined &&
    chrome.runtime &&
    chrome.runtime.connect
  );
}

const canUseDOM = !!(
  typeof window !== "undefined" &&
  window.document &&
  window.document.createElement
);

const useLayoutEffectOverride = canUseDOM ? useLayoutEffect : () => undefined;

function postMessageNoOp<O>(_msg: O): void {
  return undefined;
}

// class LoopGaurd {
//   #counter = 0;
//   constructor(public max: number = 100) {}

//   test(value) {
//     this.#counter++;
//     if (this.#counter > this.max) {
//       throw new Error(`LoopGuard exceeded max of ${this.max}`);
//     }
//     return value;
//   }
// }

// const guard = (value) => new LoopGaurd().test(value);

export {
  canUseDOM,
  useLayoutEffectOverride,
  postMessageNoOp,
  doesFunctionalityExist,
};
