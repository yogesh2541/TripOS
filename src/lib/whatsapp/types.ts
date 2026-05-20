// Wire-level types for the Meta WhatsApp Cloud API. Only the fields we
// actually depend on are typed — Meta routinely adds optional fields, so
// keeping these tight avoids breakage when the surface evolves.

export type WaApiVersion = `v${number}.${number}`;

export type WaTextPayload = {
  messaging_product: "whatsapp";
  recipient_type?: "individual";
  to: string;
  type: "text";
  text: { body: string; preview_url?: boolean };
  context?: { message_id: string };
};

export type WaTemplateLanguage = { code: string };

export type WaTemplateComponentParameter =
  | { type: "text"; text: string }
  | { type: "currency"; currency: { fallback_value: string; code: string; amount_1000: number } }
  | { type: "date_time"; date_time: { fallback_value: string } }
  | {
      type: "image" | "document" | "video";
      image?: { link: string };
      document?: { link: string; filename?: string };
      video?: { link: string };
    };

export type WaTemplateComponent =
  | {
      type: "body" | "header" | "footer";
      parameters?: WaTemplateComponentParameter[];
    }
  | {
      type: "button";
      sub_type: "url" | "quick_reply" | "copy_code";
      index: string | number;
      parameters?: WaTemplateComponentParameter[];
    };

export type WaTemplatePayload = {
  messaging_product: "whatsapp";
  to: string;
  type: "template";
  template: {
    name: string;
    language: WaTemplateLanguage;
    components?: WaTemplateComponent[];
  };
};

export type WaDocumentPayload = {
  messaging_product: "whatsapp";
  to: string;
  type: "document";
  document: {
    link: string;
    filename?: string;
    caption?: string;
  };
};

export type WaImagePayload = {
  messaging_product: "whatsapp";
  to: string;
  type: "image";
  image: { link: string; caption?: string };
};

export type WaInteractiveAction = {
  buttons?: Array<{
    type: "reply";
    reply: { id: string; title: string };
  }>;
  button?: string;
  sections?: Array<{
    title?: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
};

export type WaInteractivePayload = {
  messaging_product: "whatsapp";
  to: string;
  type: "interactive";
  interactive: {
    type: "button" | "list" | "cta_url";
    header?: { type: "text"; text: string };
    body: { text: string };
    footer?: { text: string };
    action: WaInteractiveAction;
  };
};

export type WaSendPayload =
  | WaTextPayload
  | WaTemplatePayload
  | WaDocumentPayload
  | WaImagePayload
  | WaInteractivePayload;

export type WaSendResponse = {
  messaging_product: "whatsapp";
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string; message_status?: string }>;
};

export type WaApiError = {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
    error_data?: { details?: string; messaging_product?: string };
  };
};

// === Webhook payloads ===

export type WaWebhookStatusUpdate = {
  id: string; // wamid
  recipient_id: string; // phone
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  conversation?: { id: string; origin: { type: string } };
  pricing?: { billable: boolean; pricing_model: string; category: string };
  errors?: Array<{ code: number; title: string; message?: string }>;
};

export type WaWebhookIncomingMessage = {
  id: string; // wamid
  from: string; // phone
  timestamp: string;
  type:
    | "text"
    | "image"
    | "document"
    | "audio"
    | "video"
    | "sticker"
    | "location"
    | "contacts"
    | "button"
    | "interactive"
    | "reaction"
    | "unknown";
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  document?: {
    id: string;
    mime_type: string;
    sha256: string;
    filename?: string;
    caption?: string;
  };
  button?: { text: string; payload: string };
  interactive?: {
    type: "button_reply" | "list_reply";
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  reaction?: { message_id: string; emoji: string };
  context?: { from?: string; id: string };
};

export type WaWebhookChange = {
  value: {
    messaging_product: "whatsapp";
    metadata: { display_phone_number: string; phone_number_id: string };
    contacts?: Array<{ profile: { name: string }; wa_id: string }>;
    messages?: WaWebhookIncomingMessage[];
    statuses?: WaWebhookStatusUpdate[];
    errors?: Array<{ code: number; title: string; message?: string }>;
  };
  field: "messages";
};

export type WaWebhookPayload = {
  object: "whatsapp_business_account";
  entry: Array<{
    id: string; // business account id
    changes: WaWebhookChange[];
  }>;
};
