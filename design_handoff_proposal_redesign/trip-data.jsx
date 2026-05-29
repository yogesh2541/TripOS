// Shared sample content — a 7-day Bali journey by a boutique Indian agency.
// One source of truth so the builder, web proposal, and PDF all agree.

const AGENCY = {
  name: "Wayfarer & Co.",
  tagline: "Crafted Travel",
  monogram: "W",
  phone: "+91 98200 41172",
  email: "hello@wayfarer.co",
  website: "wayfarer.co",
  city: "Mumbai",
};

const TRIP = {
  destination: "Bali",
  subtitle: "Seven unhurried days between the island's spiritual heart and its golden coast.",
  preparedFor: "Aarav & Meera Sharma",
  days: 7,
  nights: 6,
  travelers: 2,
  style: "Honeymoon",
  dateRange: "14 – 20 Sep 2025",
  startLabel: "Sun, 14 Sep",
  version: 2,
  validityDays: 14,
  preparedOn: "29 May 2025",
  summary:
    "Seven unhurried days across Bali — temple dawns and rice-terrace mornings in Ubud, a volcano sunrise over Lake Batur, the cinematic cliffs of Nusa Penida, and slow golden evenings on the Seminyak coast. Every stay hand-picked, every transfer private, nothing rushed.",
};

const DAYS = [
  {
    n: 1, date: "Sun, 14 Sep", title: "Arrival into the island's green heart",
    city: "Denpasar → Ubud", img: "day-ubud-arrival",
    text: "Touch down at Denpasar, where your private host is waiting past the arrivals hall. Wind north through terraced villages into Ubud — Bali's cultural soul — and settle into your riverside suite as the jungle hums into the evening.",
    exp: ["Private airport welcome & garland greeting", "Scenic transfer through the Ubud highlands", "Evening at leisure with a welcome dinner"],
    stay: "COMO Uma Ubud", room: "Garden Room",
    meals: ["Dinner"],
  },
  {
    n: 2, date: "Mon, 15 Sep", title: "Rice terraces & the sacred ridge",
    city: "Ubud", img: "day-tegallalang",
    text: "A slow morning among the emerald tiers of Tegallalang, then the Campuhan Ridge walk before the heat. Afternoon is yours — a Balinese massage, or the artisan streets of Ubud town.",
    exp: ["Tegallalang rice-terrace walk at golden hour", "Sacred Monkey Forest Sanctuary", "Campuhan Ridge sunrise stroll"],
    stay: "COMO Uma Ubud", room: "Garden Room",
    meals: ["Breakfast"],
    quote: "Bali rewards those who slow down — the terraces are loveliest before the day grows loud.",
  },
  {
    n: 3, date: "Tue, 16 Sep", title: "A volcano at first light",
    city: "Mount Batur", img: "day-batur",
    text: "Rise in the dark for the gentle ascent of Mount Batur, reaching the summit as the sun breaks over Lake Batur and a breakfast cooked in volcanic steam. Soak away the climb in natural hot springs on the way down.",
    exp: ["Guided Mount Batur sunrise trek", "Summit breakfast & lake panorama", "Toya Devasya hot springs", "Tirta Empul holy water temple"],
    stay: "COMO Uma Ubud", room: "Garden Room",
    meals: ["Breakfast", "Lunch"],
  },
  {
    n: 4, date: "Wed, 17 Sep", title: "Down to the golden coast",
    city: "Ubud → Seminyak", img: "day-seminyak",
    text: "A leisurely transfer south to Seminyak, trading jungle for surf. Check into your ocean-facing suite and let the afternoon dissolve into the first of Bali's famous sunsets.",
    exp: ["Private transfer to the coast", "Sunset welcome at the beach club", "Evening at leisure"],
    stay: "The Legian Seminyak", room: "Ocean Suite",
    meals: ["Breakfast"],
  },
  {
    n: 5, date: "Thu, 18 Sep", title: "The cliffs of Nusa Penida",
    city: "Nusa Penida", img: "day-penida",
    text: "A fast boat carries you to Nusa Penida, where the T-Rex ridge of Kelingking Beach drops into impossibly blue water. Broken Beach, Angel's Billabong, and a quiet lunch above the sea.",
    exp: ["Fast-boat crossing to Nusa Penida", "Kelingking Beach viewpoint", "Broken Beach & Angel's Billabong", "Cliffside seafood lunch"],
    stay: "The Legian Seminyak", room: "Ocean Suite",
    meals: ["Breakfast", "Lunch"],
    quote: "Kelingking is the photograph you came for — but the silence between the waves is what you'll remember.",
  },
  {
    n: 6, date: "Fri, 19 Sep", title: "Temples on the tide & a last sunset",
    city: "Tanah Lot · Seminyak", img: "day-tanahlot",
    text: "A spa morning, then out to Tanah Lot — the sea temple that seems to float at high tide — for golden hour. A final dinner on the sand, toes in the cooling evening.",
    exp: ["Couples' spa ritual", "Tanah Lot sea-temple sunset", "Farewell beachfront dinner"],
    stay: "The Legian Seminyak", room: "Ocean Suite",
    meals: ["Breakfast"],
  },
  {
    n: 7, date: "Sat, 20 Sep", title: "Until the next horizon",
    city: "Seminyak → Denpasar", img: null,
    text: "A slow breakfast by the ocean, then a private transfer to Denpasar for your flight home — carrying a little of the island with you.",
    exp: ["Leisure morning", "Private departure transfer"],
    stay: null, room: null,
    meals: ["Breakfast"],
  },
];

const GLANCE = DAYS.map((d) => ({
  n: d.n, date: d.date, where: d.city,
  stay: d.stay || "Departure",
  highlights: d.exp.slice(0, 2).join(" · "),
}));

const INCLUDED = [
  "6 nights in hand-picked luxury stays",
  "Daily breakfast; meals as marked per day",
  "All private airport & inter-city transfers",
  "Private air-conditioned vehicle with driver",
  "English-speaking local guide on tour days",
  "Mount Batur sunrise trek with summit breakfast",
  "Nusa Penida fast-boat crossing & island tour",
  "All entrance fees for listed sights",
  "24×7 on-trip concierge support",
];
const EXCLUDED = [
  "International airfare & airport taxes",
  "Lunches & dinners unless specified",
  "Travel insurance (recommended)",
  "Indonesia visa-on-arrival fees",
  "Personal expenses, tips & gratuities",
  "Anything not listed under inclusions",
];

const PRICING = {
  total: 348000,
  perPerson: 174000,
  travelers: 2,
  categories: [
    { label: "Flights", amount: 96000 },
    { label: "Accommodation", amount: 146000 },
    { label: "Experiences", amount: 52000 },
    { label: "Transfers & transport", amount: 34000 },
    { label: "Other", amount: 20000 },
  ],
  validUntil: "12 Jun 2025",
};

// Operator-side builder figures (cost → markup → discount → selling).
const BUILDER = {
  groups: [
    { cat: "Accommodation", items: [
      { label: "COMO Uma Ubud · Garden Room · 3N", cost: 72000 },
      { label: "The Legian Seminyak · Ocean Suite · 3N", cost: 46000 },
    ]},
    { cat: "Flights", items: [
      { label: "BOM → DPS return · 2 pax", cost: 88000 },
    ]},
    { cat: "Experiences", items: [
      { label: "Mount Batur sunrise trek (private)", cost: 14000 },
      { label: "Nusa Penida fast boat + island tour", cost: 19000 },
      { label: "Tanah Lot & temples guided day", cost: 8000 },
    ]},
    { cat: "Transfers", items: [
      { label: "Airport transfers (arrival + departure)", cost: 6000 },
      { label: "Private vehicle + driver · 6 days", cost: 24000 },
    ]},
    { cat: "Other", items: [
      { label: "Couples' spa ritual", cost: 7000 },
      { label: "Welcome dinner & garlands", cost: 6000 },
    ]},
  ],
  subtotal: 290000,
  markupPct: 22,
  markupAmt: 63800,
  discountPct: 1.6,
  discountAmt: 5800,
  selling: 348000,
  perPerson: 174000,
  profit: 58000,
  marginPct: 16.7,
};

function inr(n) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

Object.assign(window, { AGENCY, TRIP, DAYS, GLANCE, INCLUDED, EXCLUDED, PRICING, BUILDER, inr });
