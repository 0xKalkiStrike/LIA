import React from "react";
import { Button } from "lia-ui";
import { Phone, Send, Trash2 } from "lucide-react";

// LIA's UI always sits on the app's dark body background - these previews
// compose against the same surface so light/transparent variants (Ghost,
// Secondary) render as they actually do in the product.
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[var(--bg-darker)] p-6 inline-block rounded-lg">{children}</div>
);

export const Primary = () => (
  <Stage>
    <Button variant="primary">Live Call</Button>
  </Stage>
);

export const Secondary = () => (
  <Stage>
    <Button variant="secondary">Cancel</Button>
  </Stage>
);

export const Danger = () => (
  <Stage>
    <Button variant="danger" icon={<Trash2 />}>
      End Call
    </Button>
  </Stage>
);

export const Ghost = () => (
  <Stage>
    <Button variant="ghost">Dismiss</Button>
  </Stage>
);

export const WithIcon = () => (
  <Stage>
    <Button variant="primary" icon={<Phone />}>
      Start Call
    </Button>
  </Stage>
);

export const IconOnly = () => (
  <Stage>
    <Button variant="primary" className="!px-3">
      <Send className="w-4 h-4" />
    </Button>
  </Stage>
);

export const Disabled = () => (
  <Stage>
    <Button variant="primary" disabled>
      Sending…
    </Button>
  </Stage>
);
