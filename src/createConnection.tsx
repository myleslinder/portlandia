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
	PortDisconnectListener,
	PortErrorMessage,
	PortMessageListener,
	PortStatus,
	PostMessageFn,
} from "~/types";
import { useBeforeUnload } from "~/useBeforeUnload";
import {
	canUseDOM,
	doesFunctionalityExist,
	postMessageNoOp,
	useLayoutEffectOverride,
} from "~/utils";

function createPortConnection<I, O>({
	channelName,
	extensionId,
	includeTlsChannelId,
	validator = (m: unknown): m is I => !!m,
	debug = false,
}: ConnectionOptions<I>): {
	usePortListener: () => boolean;
	usePortConnection: (
		listener?: ChromeMessagingListener<I> | undefined,
	) => ChromeMessagingCtx<O>;
	PortConnectionProvider: ({
		children,
	}: {
		children: ReactNode;
	}) => JSX.Element;
} {
	const listenerMap: { [id: string]: ChromeMessagingListener<I> } = {
		root: () => undefined,
	};
	let rootPortError: string | undefined;
	let port: chrome.runtime.Port | null = null;

	const messageListener: PortMessageListener = (message, _port) => {
		if (debug) {
			console.log("calling port listeners with ", message);
		}
		Object.values(listenerMap).forEach((listener) => {
			if (validator(message)) {
				listener.call(null, message);
			}
		});
	};

	const mainDisconnectListener: PortDisconnectListener = () => {
		if (chrome.runtime.lastError) {
			rootPortError = chrome.runtime.lastError.message;
		}
	};

	if (canUseDOM && doesFunctionalityExist()) {
		port = chrome.runtime.connect(extensionId, {
			name: channelName,
			includeTlsChannelId,
		});
		port.onMessage.addListener(messageListener);
		port.onDisconnect.addListener(mainDisconnectListener);

		window.addEventListener("beforeunload", () => {
			if (port && !rootPortError) {
				port.onMessage.removeListener(messageListener);
				port.disconnect();
			}
		});
	} else {
		if (debug) {
			console.log("No connection to establish");
		}
	}

	const MessagingContext = createContext<ChromeMessagingCtx<O> | null>(null);

	return {
		PortConnectionProvider,
		usePortConnection,
		usePortListener,
	};

	function PortConnectionProvider({
		children,
	}: {
		children: ReactNode | undefined;
	}) {
		const [portStatus, setPortStatus] = useState<PortStatus>("idle");
		const [error, setError] = useState<PortErrorMessage>(rootPortError ?? null);
		const postMessageFnRef = useRef<PostMessageFn<O>>(postMessageNoOp);

		const disconnectListener = useCallback<PortDisconnectListener>((port) => {
			if (debug) {
				console.log("disconnecting: ", port.name);
			}
			if (chrome.runtime.lastError) {
				if (debug) {
					console.error(
						"disconnecting because of error: ",
						chrome.runtime.lastError.message,
					);
				}
				setError(
					chrome.runtime.lastError.message ?? "An unknown error occurred",
				);
			}
			setPortStatus("closed");
			postMessageFnRef.current = postMessageNoOp;
		}, []);

		const unloadCb = useCallback(() => {
			if (port) {
				port.onDisconnect.removeListener(disconnectListener);
			}
		}, [disconnectListener]);

		useBeforeUnload(unloadCb);

		useEffect(() => {
			if (debug) {
				console.log("re-running port creation/check");
			}
			if (rootPortError) {
				return;
			}
			try {
				if (port) {
					postMessageFnRef.current = port.postMessage.bind(port);

					port.onDisconnect.addListener(disconnectListener);
					setPortStatus("open");
					return () => {
						if (debug) {
							console.log("cleaning up port creation/check");
						}
						if (port) {
							port.onDisconnect.removeListener(disconnectListener);
						}

						setPortStatus("closed");
					};
				}
			} catch (e) {
				console.error("error establishing connection to extension", e);
				setPortStatus("closed");
				if (e instanceof Error) {
					setError(e.message);
				}
			}
		}, [disconnectListener]);

		const safePostMessage = useCallback<PostMessageFn<O>>(
			(m) => {
				if (portStatus === "open") {
					postMessageFnRef.current(m);
					return;
				}
				if (debug) {
					console.log(
						"called post message with no open port, port status: ",
						portStatus,
					);
				}
			},
			[portStatus],
		);

		return (
			<MessagingContext.Provider
				value={{
					postMessage: safePostMessage,
					status: portStatus,
					error,
				}}
			>
				{children}
			</MessagingContext.Provider>
		);
	}

	function usePortListener(listener?: ChromeMessagingListener<I>): boolean {
		const listenerId = useId();
		useLayoutEffectOverride(() => {
			if (!port || rootPortError) {
				return;
			}
			if (listener) {
				if (debug) {
					console.log("attaching listener with id: ", listenerId);
				}
				listenerMap[listenerId] = listener;
			}
		}, [listener]);
		return doesFunctionalityExist();
	}

	function usePortConnection(listener?: ChromeMessagingListener<I>) {
		const listenerId = useId();
		const connectionCtx = useContext(MessagingContext);

		useLayoutEffectOverride(() => {
			if (!port || rootPortError) {
				return;
			}
			if (listener) {
				if (debug) {
					console.log("attaching listener with id: ", listenerId);
				}
				listenerMap[listenerId] = listener;
			}
		}, [listener]);

		if (!connectionCtx) {
			throw new Error(
				"`usePortConnection` must be used within a `PortConnectionProvider`",
			);
		}

		return connectionCtx;
	}
}

export { doesFunctionalityExist } from "./utils";
export type { ChromeMessagingListener, ConnectionOptions };
export { createPortConnection };
