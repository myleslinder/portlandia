import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import type {
	ChromeMessagingCtx,
	ChromeMessagingListener,
	ConnectionOptions,
	PortDisconnectListener,
	PortMessageListener,
	PortStatus,
	PostMessageFn,
} from "~/types";

/**
 * `chrome` will only have a value if the `externally_connectable` manifest property
 *  contains a match for the url we're running on:
 * [externally_connectable - Chrome Developers]
 * (https://developer.chrome.com/docs/extensions/mv3/manifest/externally_connectable/)
 *
 */
const doesFunctionalityExist: () => boolean = () =>
	(typeof chrome as unknown) !== undefined &&
	chrome.runtime &&
	typeof chrome.runtime.connect === "function"
		? true
		: false;

const canUseDOM = !!(
	typeof window !== "undefined" &&
	window.document &&
	window.document.createElement
);

const useIsomorphicEffect = canUseDOM ? useLayoutEffect : useEffect;

function useBeforeUnload(callback: () => unknown): void {
	useEffect(() => {
		window.addEventListener("beforeunload", callback);
		return () => {
			window.removeEventListener("beforeunload", callback);
		};
	}, [callback]);
}

function postMessageNoOp<O>(_msg: O): void {
	return undefined;
}

type PortHooksWithProvider<I, O> = {
	usePortListener: (
		listener: ChromeMessagingListener<I>,
		flush?: boolean,
	) => void;
	usePortConnection: (
		listener?: ChromeMessagingListener<I> | undefined,
		flush?: boolean,
	) => ChromeMessagingCtx<O>;
	PortConnectionProvider: React.FC<{ children: ReactNode }>;
};

function createPortConnection<I, O>({
	channelName,
	extensionId,
	includeTlsChannelId,
	validator = (m: unknown): m is I => !!m,
	debug = false,
}: ConnectionOptions<I>): PortHooksWithProvider<I, O> {
	const listenerMap: Map<string, ChromeMessagingListener<I>> = new Map();
	let _cachedMessage: I | null = null;

	let rootPortError: Error | undefined;
	let port: chrome.runtime.Port | null = null;

	const messageListener: PortMessageListener = (message, _port) => {
		if (debug) {
			console.log("calling port listeners with ", message);
		}

		if (validator(message)) {
			const listeners = Array.from(listenerMap.values());
			_cachedMessage = message;

			listeners.forEach((listener) => {
				listener.call(null, message);
			});
		}
	};

	const mainDisconnectListener: PortDisconnectListener = () => {
		if (chrome.runtime.lastError) {
			rootPortError = new Error(chrome.runtime.lastError.message);
		}
	};

	const connect = () => {
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
		return port;
	};
	connect();

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
		const [error, setError] = useState<Error | null>(rootPortError ?? null);
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
					new Error(
						chrome.runtime.lastError.message ?? "An unknown error occurred",
					),
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
			if (error) {
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
				if (debug) {
					console.error("error establishing connection to extension", e);
				}
				setPortStatus("closed");
				if (e instanceof Error) {
					setError(e);
				}
			}
		}, [disconnectListener, error]);

		useEffect(() => {
			if (portStatus === "closed" && !error) {
				const newPort = connect();
				if (newPort) {
					postMessageFnRef.current = newPort.postMessage.bind(port);
					newPort.onDisconnect.addListener(disconnectListener);
					setPortStatus("open");
					if (debug) {
						console.log("successfully reopened port and sent message");
					}
					port = newPort;
				} else {
					if (debug) {
						console.log("unable to open port continuation");
					}
				}
			}
		}, [portStatus, disconnectListener, error]);

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
				// const newPort = connect();
				// if (newPort) {
				// 	postMessageFnRef.current = newPort.postMessage.bind(port);
				// 	newPort.onDisconnect.addListener(disconnectListener);
				// 	setPortStatus("open");
				// 	if (debug) {
				// 		console.log("successfully reopened port and sent message");
				// 	}
				// 	newPort.postMessage(m);
				// 	return;
				// }
			},
			[portStatus],
		);
		const ctx = {
			postMessage: safePostMessage,
			status: portStatus,
			error,
		};
		return (
			<MessagingContext.Provider value={ctx}>
				{children}
			</MessagingContext.Provider>
		);
	}

	function usePortListener(
		listener?: ChromeMessagingListener<I>,
		flush?: boolean,
	) {
		const listenerId = useId();
		useIsomorphicEffect(() => {
			if (listener) {
				if (debug) {
					console.log("attaching listener with id: ", listenerId);
				}
				if (flush && _cachedMessage && !listenerMap.has(listenerId)) {
					Promise.resolve()
						.then(() => {
							if (_cachedMessage) {
								listener(_cachedMessage);
							}
						})
						.catch(console.error);
				}
				listenerMap.set(listenerId, listener);
			}
			return () => {
				listenerMap.delete(listenerId);
			};
		}, [listener, listenerId]);
		return;
	}

	function usePortConnection(
		listener?: ChromeMessagingListener<I>,
		flush?: boolean,
	) {
		const listenerId = useId();
		const connectionCtx = useContext(MessagingContext);

		useIsomorphicEffect(() => {
			if (!port || rootPortError) {
				return;
			}
			if (listener) {
				if (debug) {
					console.log("attaching listener with id: ", listenerId);
				}
				if (flush && _cachedMessage && !listenerMap.has(listenerId)) {
					Promise.resolve()
						.then(() => {
							if (_cachedMessage) {
								listener(_cachedMessage);
							}
						})
						.catch(console.error);
				}
				listenerMap.set(listenerId, listener);
				return () => {
					listenerMap.delete(listenerId);
				};
			}
		}, [listener, listenerId]);

		if (!connectionCtx) {
			throw new Error(
				"`usePortConnection` must be used within a `PortConnectionProvider`",
			);
		}

		return connectionCtx;
	}
}

export type { ChromeMessagingListener, ConnectionOptions };
export { createPortConnection, doesFunctionalityExist };
