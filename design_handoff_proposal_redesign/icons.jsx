// Shared lucide-style icons for the proposal redesign mockups.
// Exported to window so every Babel screen file can use them.
const I = ({ d, children, sw = 1.6, fill = "none", ...p }) => (
  <svg viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" {...p}>
    {d ? <path d={d} /> : children}
  </svg>
);

const Compass = (p) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M16.2 7.8 13.4 13.4 7.8 16.2 10.6 10.6z" /></I>;
const Calendar = (p) => <I {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></I>;
const MapPin = (p) => <I {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></I>;
const Users = (p) => <I {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></I>;
const Building = (p) => <I {...p}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01" /></I>;
const Check = (p) => <I {...p}><path d="M20 6 9 17l-5-5" /></I>;
const X = (p) => <I {...p}><path d="M18 6 6 18M6 6l12 12" /></I>;
const Plane = (p) => <I {...p}><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5S18 3 16.5 4.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></I>;
const Train = (p) => <I {...p}><rect x="4" y="3" width="16" height="16" rx="2" /><path d="M4 11h16M12 3v8M8 19l-2 3M16 19l2 3" /><circle cx="8.5" cy="15.5" r="0.5" fill="currentColor" /><circle cx="15.5" cy="15.5" r="0.5" fill="currentColor" /></I>;
const Link = (p) => <I {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></I>;
const MessageCircle = (p) => <I {...p}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></I>;
const Download = (p) => <I {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></I>;
const Mail = (p) => <I {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></I>;
const Send = (p) => <I {...p}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z" /></I>;
const ChevronDown = (p) => <I {...p}><path d="m6 9 6 6 6-6" /></I>;
const ChevronRight = (p) => <I {...p}><path d="m9 18 6-6-6-6" /></I>;
const Grip = (p) => <I {...p}><circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" /></I>;
const Info = (p) => <I {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></I>;
const Sparkles = (p) => <I {...p}><path d="M12 3 13.9 8.6 19.5 10.5 13.9 12.4 12 18 10.1 12.4 4.5 10.5 10.1 8.6z" /></I>;
const Wand = (p) => <I {...p}><path d="m15 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1zM9 11 4 16a2 2 0 0 0 3 3l5-5M14 7l3 3" /></I>;
const Plus = (p) => <I {...p}><path d="M12 5v14M5 12h14" /></I>;
const Eye = (p) => <I {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></I>;
const Phone = (p) => <I {...p}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></I>;
const Globe = (p) => <I {...p}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z" /></I>;
const Clock = (p) => <I {...p}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></I>;
const ArrowRight = (p) => <I {...p}><path d="M5 12h14M13 5l7 7-7 7" /></I>;
const ArrowLeft = (p) => <I {...p}><path d="M19 12H5M11 19l-7-7 7-7" /></I>;
const Copy = (p) => <I {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></I>;
const Utensils = (p) => <I {...p}><path d="M3 2v7a3 3 0 0 0 6 0V2M6 2v20M19 2v20c-3 0-4-1-4-4V8c0-4 1-6 4-6Z" /></I>;
const Star = (p) => <I {...p}><path d="M12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.5 5.8 21 7 14 2 9.3 9 8.5z" /></I>;
const FileText = (p) => <I {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></I>;
const Edit = (p) => <I {...p}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></I>;
const Layers = (p) => <I {...p}><path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5" /></I>;

Object.assign(window, {
  Compass, Calendar, MapPin, Users, Building, Check, X, Plane, Train, Link,
  MessageCircle, Download, Mail, Send, ChevronDown, ChevronRight, Grip, Info,
  Sparkles, Wand, Plus, Eye, Phone, Globe, Clock, ArrowRight, ArrowLeft, Copy,
  Utensils, Star, FileText, Edit, Layers,
});
