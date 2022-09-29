type PortMessageListener = Parameters<
	typeof chrome.runtime.onConnectExternal["addListener"]
>[0];
type PortListenerParam = Parameters<PortMessageListener>[0];

type MessageListener = Parameters<
	typeof chrome.runtime.onMessage["addListener"]
>[0];

type MessageListenerParams = Parameters<MessageListener>;

// TODO: handle channel names somehow
// import { EXTERNAL_PORT_NAME } from "~/constants";

type Event = "connect" | "disconnect" | "message";
type Port = chrome.runtime.Port;

type Listener<T> = {
	validator?: (message: unknown) => message is T;
	handler: (message: T, port: Port) => void;
};

class PortManager<I, O> {
	#ports = new Map<number, Port>();
	#listeners = new Map<Event, Required<Listener<I>>[]>();

	constructor(listeners?: Record<Event, Listener<I>>) {
		Object.entries(listeners ?? {}).forEach(([event, listener]) => {
			this.#addListener(event as Event, {
				handler: listener.handler,
				validator: listener.validator ?? ((m): m is I => !!m),
			});
		});
	}

	public on(event: Event, listener: Listener<I>) {
		this.#addListener(event, listener);
	}

	public postMessage(tabId: number, message: O) {
		const port = this.#ports.get(tabId);
		if (port) {
			port.postMessage(message);
			return;
		}
		console.log("no port for tab id ", tabId);
	}

	public connectionListener = this._connectionListener.bind(this);
	private _connectionListener(port: PortListenerParam) {
		console.log("new port", port.name, port.sender?.tab?.id);
		if (port.sender?.tab?.id) {
			this.#ports.set(port.sender.tab.id, port);
			port.onMessage.addListener(this.#messageListener.bind(this, "message"));
			port.onDisconnect.addListener(this.#disconnectionListener.bind(this));
			// this.#messageListener("connect", undefined, this.#port);
		}
	}

	public getPort(tabId: number) {
		return this.#ports.get(tabId);
	}

	public closeAllPorts() {
		Array.from(this.#ports.values()).map((p) => p.disconnect());
		return this.#ports.clear();
	}

	#addListener(event: Event, listener: Listener<I>) {
		const existing = this.#listeners.get(event) ?? [];

		this.#listeners.set(event, [
			...existing,
			{
				handler: listener.handler,
				validator: listener.validator ?? ((m): m is I => !!m),
			},
		]);
	}

	#messageListener(event: Event, message: unknown, port: Port) {
		[...this.#listeners.entries()]
			.filter(([k]) => k === event)
			.forEach(([_, listeners]) => {
				listeners.forEach((listener) => {
					const validated = listener.validator(message);
					if (validated) {
						listener.handler(message, port);
					}
				});
			});
	}
	#disconnectionListener(port: Port) {
		if (port.sender?.tab?.id) {
			this.#ports.delete(port.sender.tab.id);
			// this.#listeners = new Map();
		}
	}
}

export { PortManager };
export type { MessageListener, MessageListenerParams };
