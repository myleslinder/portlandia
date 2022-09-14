# ⚛ React Chrome Connect &nbsp;![](https://img.shields.io/npm/v/react-chrome-connect.svg)

> **Warning**
> You probably don't want to use this

Create long lived connections from a react web app to a chrome extension using runtime ports.

- For [Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/mv3-overview/)
- See [message passing long lived connections](https://developer.chrome.com/docs/extensions/mv3/messaging/#connect)
- Needs React 18 (uses [`useId`](https://beta.reactjs.org/apis/react/useId))

  - Works with SSR

- If using this in a web app to communicate with an extension then the [`externally_connectable`](https://developer.chrome.com/docs/extensions/mv3/manifest/externally_connectable/) manifest property should contain a match for the url your app is running on
  - If it doesn't then nothing will break but no port will be opened - this is the same behavior as if there were no extension installed).
- You'll see an error logged if there is an extension that lists your url in the `externally_connectable` property but you pass an id that doesn't match an available extension (one with your url in the `externally_connectable` property)

## Usage

Outside of a component create the port connection

```typescript
// /lib/connect.ts

import { createPortConnection } from "react-chrome-connect";

const CHROME_EXTENSION_ID = "some-extension-id";
const CHANNEL_NAME = "channel-name";

type Incoming = { query: string };
type Outgoing = string;

const { PortConnectionProvider, usePortListener, usePortConnection } =
	createPortConnection<Incoming, Outgoing>({
		channelName: CHANNEL_NAME,
		extensionId: CHROME_EXTENSION_ID,
		validator: (m): m is Incoming => {
			return typeof m === "object" && m !== null && "query" in m;
		},
		debug: true,
	});

export type { Incoming, Outgoing };
export { PortConnectionProvider, usePortListener, usePortConnection };
```

If you just need to listen and not post messages back then in your components you can just use the listener.

```ts
import type { ChromeMessagingListener } from "react-chrome-connect";
import { usePortListener, type Incoming } from "~/lib/chrome/connect";

function Cmp() {
	const onChromeMessageCb = useCallback<ChromeMessagingListener<Incoming>>(
		(message) => {
			// do something here
		},
		[],
	);
	usePortListener(onChromeMessageCb);
}
```

If you need to send messages and (optionally) listen then wrap those components in the provider.

```ts
import { PortConnectionProvider } from "~/lib/chrome/connect";

export default function App() {
	const { user } = useLoaderData<typeof loader>();

	return (
		<div>
			<PortConnectionProvider>
				{/* add components in here */}
			</PortConnectionProvider>
		</div>
	);
}

import type { ChromeMessagingListener } from "react-chrome-connect";
import { usePortListener, type Incoming } from "~/lib/chrome/connect";

function Cmp() {
	const { postMessage, status, error } = usePortConnection();
}
```

## License

MIT
