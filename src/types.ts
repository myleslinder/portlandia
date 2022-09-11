type ChromeMessagingListener<T> = (message: T) => void;
type Port = chrome.runtime.Port;
type PortMessageListener = Parameters<Port["onMessage"]["addListener"]>[0];
type PortDisconnectListener = Parameters<
	Port["onDisconnect"]["addListener"]
>[0];
type PortStatus = "idle" | "open" | "closed";
type PortErrorMessage = string | null;

type PostMessageFn<O> = (msg: O) => void;

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type ChromeMessagingCtx<O = any> = {
	postMessage: PostMessageFn<O>;
	status: PortStatus;
	error: PortErrorMessage;
};

// TODO: add a keep alive option?
type ConnectionOptions<T> = {
	channelName: string;
	extensionId: string;
	debug: boolean;
	validator?: (m: unknown) => m is T;
	includeTlsChannelId?: boolean;
};

export type {
	ChromeMessagingCtx,
	PortStatus,
	PortErrorMessage,
	PostMessageFn,
	ChromeMessagingListener,
	PortMessageListener,
	PortDisconnectListener,
	ConnectionOptions,
	Port,
};
