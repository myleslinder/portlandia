import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  ChromeMessagingCtx,
  ChromeMessagingListener,
  ConnectionOptions,
  Port,
  PortDisconnectListener,
  PortErrorMessage,
  PortMessageListener,
  PortStatus,
  PostMessageFn,
} from "~/types";
import { useBeforeUnload } from "~/useBeforeUnload";
import {
  doesFunctionalityExist,
  postMessageNoOp,
  useLayoutEffectOverride,
} from "~/utils";

function createPortConnection<I, O>({
  channelName,
  extensionId,
  includeTlsChannelId,
  debug = false,
}: ConnectionOptions) {
  const baseCtx: ChromeMessagingCtx = {
    postMessage: postMessageNoOp,
    status: "idle",
    error: null,
  };

  const listenerMap: { [id: string]: ChromeMessagingListener<I> } = {
    root: () => undefined,
  };

  const MessagingContext = createContext<ChromeMessagingCtx<O>>(baseCtx);

  function usePort(listener?: ChromeMessagingListener<I>) {
    const [portStatus, setPortStatus] = useState<PortStatus>("idle");
    const [error, setError] = useState<PortErrorMessage>(null);
    const portRef = useRef<Port | null>(null);
    const postMessageFnRef = useRef<PostMessageFn<O>>(postMessageNoOp);

    useLayoutEffectOverride(() => {
      if (debug) {
        console.log("updating root listener");
      }
      if (listener) {
        listenerMap["root"] = listener;
      }
    }, [listener]);

    const messageListener = useCallback<PortMessageListener>(
      (message, _port) => {
        if (debug) {
          console.log("calling port listeners with ", message);
        }
        Object.values(listenerMap).forEach((listener) => {
          listener.call(null, message);
        });
      },
      []
    );

    const disconnectListener = useCallback<PortDisconnectListener>((port) => {
      if (debug) {
        console.log("disconnecting: ", port.name);
      }
      if (chrome.runtime.lastError) {
        if (debug) {
          console.error(
            "disconnecting because of error: ",
            chrome.runtime.lastError.message
          );
        }
        setError(chrome.runtime.lastError.message ?? null);
      }
      setPortStatus("closed");
      postMessageFnRef.current = postMessageNoOp;
    }, []);

    useBeforeUnload(() => {
      if (portRef.current) {
        setPortStatus("closed");
        portRef.current.onMessage.removeListener(messageListener);
        portRef.current.onDisconnect.removeListener(disconnectListener);
        portRef.current.disconnect();
      }
    });

    useEffect(() => {
      if (debug) {
        console.log("re-running port creation/check");
      }
      try {
        if (doesFunctionalityExist()) {
          const port = chrome.runtime.connect(extensionId, {
            name: channelName,
            includeTlsChannelId,
          });
          portRef.current = port;
          postMessageFnRef.current = port.postMessage.bind(port);
          port.onMessage.addListener(messageListener);
          port.onDisconnect.addListener(disconnectListener);
          setPortStatus("open");
          return () => {
            if (debug) {
              console.log("cleaning up port creation/check");
            }
            setPortStatus("closed");
            port.onMessage.removeListener(messageListener);
            port.onDisconnect.removeListener(disconnectListener);
            port.disconnect();
            portRef.current = null;
          };
        }
      } catch (e) {
        console.error("error establishing connection to extension", e);
        setPortStatus("closed");
        if (e instanceof Error) {
          setError(e.message);
        }
      }
    }, [messageListener, disconnectListener]);

    const safePostMessage = useCallback<PostMessageFn<O>>(
      (m) => {
        if (portStatus === "open") {
          postMessageFnRef.current(m);
          return;
        }
        if (debug) {
          console.log(
            "called post message with no open port, port status: ",
            portStatus
          );
        }
      },
      [portStatus]
    );

    const ctx = {
      postMessage: safePostMessage,
      status: portStatus,
      error,
    };

    function MessagingProvider({
      children,
    }: {
      children: ReactNode | undefined;
    }) {
      return (
        <MessagingContext.Provider value={ctx}>
          {children}
        </MessagingContext.Provider>
      );
    }

    return {
      MessagingProvider,
      ...ctx,
    };
  }

  function usePortConnection(listener?: ChromeMessagingListener<I>) {
    const listenerId = useId();
    const connectionCtx = useContext(MessagingContext);

    useLayoutEffectOverride(() => {
      if (listener) {
        if (debug) {
          console.log("attaching listener with id: ", listenerId);
        }
        listenerMap[listenerId] = listener;
      }
    }, [listener]);

    if (!connectionCtx) {
      throw new Error("useConnection must be used within a MessagingProvider");
    }

    return connectionCtx;
  }

  return {
    usePort,
    usePortConnection,
  };
}

export type { ChromeMessagingListener, ConnectionOptions };
export { createPortConnection };
