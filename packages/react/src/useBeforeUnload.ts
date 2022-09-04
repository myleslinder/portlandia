import { useEffect } from "react";

function useBeforeUnload(callback: () => any): void {
  useEffect(() => {
    window.addEventListener("beforeunload", callback);
    return () => {
      window.removeEventListener("beforeunload", callback);
    };
  }, [callback]);
}

export { useBeforeUnload };
