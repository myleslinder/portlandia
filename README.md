# ⚛ React Chrome Connect &nbsp;![](https://img.shields.io/npm/v/react-chrome-connect.svg)

> don't use this

- For [Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/mv3-overview/)
- See [message passing long lived connections](https://developer.chrome.com/docs/extensions/mv3/messaging/#connect)
- Needs React 18 (uses [`useId`](https://beta.reactjs.org/apis/react/useId))

  - Works with SSR

- If using this in a web app to communicate with an extension then the [`externally_connectable`](https://developer.chrome.com/docs/extensions/mv3/manifest/externally_connectable/) manifest property should contain a match for the url your app is running on
  - If it doesn't then nothing will break but no port will be opened - this is the same behavior as if there were no extension installed).
- You'll see an error logged if there is an extension that lists your url in the `externally_connectable` property but you pass an id that doesn't match an available extension (one with your url in the `externally_connectable` property)

- outside of a component create a port connection

```typescript
// /lib/connect.ts

import { createPortConnection } from "react-chrome-connect";

const CHROME_EXTENSION_ID = "some-extension-id";
const CHANNEL_NAME = "channel-name";

type Incoming = { query: string };
type Outgoing = { anything: string };

const { usePort, usePortConnection } = createPortConnection<Incoming, Outgoing>(
  {
    channelName: CHANNEL_NAME,
    extensionId: CHROME_EXTENSION_ID,
    debug: true,
  }
);

export { usePort, usePortConnection };
```

## License

MIT
