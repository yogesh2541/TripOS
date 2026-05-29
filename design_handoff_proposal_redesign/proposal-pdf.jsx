// Proposal PDF — A4 pages mirroring the web proposal, paginated for print.
function PdfRun({ page, total }) {
  const { AGENCY, TRIP } = window;
  return (
    <div className="pdf-run">
      <span className="seal on-light">{AGENCY.monogram}</span>
      <span className="nm">{AGENCY.name}</span>
      <span className="tr">· {TRIP.destination} · v{TRIP.version}</span>
      <span className="sp"></span>
      <span className="pg">Page {page} of {total}</span>
    </div>
  );
}
function PdfFoot() {
  const { AGENCY } = window;
  return (
    <div className="pdf-foot">
      <span>Crafted with TripCraft · for {AGENCY.name}</span>
      <span>{AGENCY.website}</span>
    </div>
  );
}
function PdfSH({ eyebrow, title }) {
  return (
    <div className="pdf-sh">
      <span className="eyb">{eyebrow}</span>
      <h2>{title}</h2>
      <hr className="rule-gold" />
    </div>
  );
}

// ---- Page 1 · Cover ----
function PdfCover() {
  const { AGENCY, TRIP } = window;
  return (
    <div className="pdf-cover">
      <image-slot id="pdf-cover-bali" shape="rect" placeholder="Bali cover photo"></image-slot>
      <div className="scrim"></div>
      <div className="glow"></div>
      <div className="pdf-cover-inner">
        <div className="cover-top">
          <div className="cover-brand">
            <span className="seal" style={{ width: 40, height: 40, fontSize: 15, background: "rgba(255,255,255,.05)" }}>{AGENCY.monogram}</span>
            <div>
              <div className="cover-word">WAYFARER &amp; CO.</div>
              <div className="cover-tag">{AGENCY.tagline}</div>
            </div>
          </div>
          <div className="cover-vrow">
            <div className="l">Travel Proposal</div>
            <div className="v">v{TRIP.version}</div>
          </div>
        </div>
        <div className="cover-headline">
          <div className="cover-kicker">A journey for {TRIP.travelers}</div>
          <div className="cover-title">{TRIP.destination}</div>
          <div className="cover-sub">{TRIP.subtitle}</div>
          <div className="cover-prepared">Prepared for <b>{TRIP.preparedFor}</b></div>
          <div className="cover-meta">
            <div className="cmeta"><div className="l"><window.Calendar /> Duration</div><div className="v">{TRIP.days} days / {TRIP.nights} nights</div></div>
            <div className="cmeta"><div className="l"><window.MapPin /> Travel dates</div><div className="v">{TRIP.dateRange}</div></div>
            <div className="cmeta"><div className="l"><window.Users /> Travellers</div><div className="v">{TRIP.travelers} guests</div></div>
            <div className="cmeta"><div className="l"><window.Compass /> Style</div><div className="v">{TRIP.style}</div></div>
          </div>
          <div style={{ marginTop: 22, fontSize: 10, letterSpacing: ".04em", color: "rgba(255,255,255,.5)" }}>
            Prepared {TRIP.preparedOn} · Valid for {TRIP.validityDays} days
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Page 2 · At a glance ----
function PdfGlance() {
  const { GLANCE, TRIP } = window;
  return (
    <div className="pdf">
      <PdfRun page={2} total={6} />
      <div className="pdf-content">
        <PdfSH eyebrow="The Overview" title="Trip at a glance" />
        <p style={{ fontSize: 12.5, lineHeight: 1.75, color: "var(--ink-2)", margin: "0 0 24px", maxWidth: 560 }}>
          {TRIP.summary}
        </p>
        <table className="gtbl">
          <thead>
            <tr><th style={{ width: 96 }}>Day</th><th>Where</th><th>Stay</th><th>Highlights</th></tr>
          </thead>
          <tbody>
            {GLANCE.map((g) => (
              <tr key={g.n}>
                <td><div className="dn">{String(g.n).padStart(2, "0")}</div><div className="dd">{g.date}</div></td>
                <td><span className="pl">{g.where}</span></td>
                <td>{g.stay}</td>
                <td>{g.highlights}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PdfFoot />
    </div>
  );
}

function PdfDay({ d }) {
  return (
    <div className="pdf-day">
      <div>
        <div className="dnum">{String(d.n).padStart(2, "0")}</div>
        <div className="ddate">{d.date}</div>
      </div>
      <div>
        <div className="flex jb ac">
          <div>
            <div className="dtitle">{d.title}</div>
            <div className="dpin"><window.MapPin /> {d.city}</div>
          </div>
          {d.meals && d.meals.length > 0 && (
            <div className="dmeals">{d.meals.map((m) => <span className="mchip" key={m}>{m}</span>)}</div>
          )}
        </div>
        <div className="dtext">{d.text}</div>
        <div className="dexp">
          {d.exp.map((e, i) => <div className="e" key={i}><span className="b"></span>{e}</div>)}
        </div>
        {d.stay && (
          <div className="dstay">
            <window.Building style={{ width: 16, height: 16, color: "var(--sand-deep)" }} />
            <div><div className="l">Where you'll stay</div><div className="v">{d.stay} · {d.room}</div></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Page 3 · Days 1–3 ----
function PdfDays1() {
  const { DAYS } = window;
  return (
    <div className="pdf">
      <PdfRun page={3} total={6} />
      <div className="pdf-content">
        <PdfSH eyebrow="The Journey" title="Day by day" />
        {DAYS.slice(0, 3).map((d) => <PdfDay key={d.n} d={d} />)}
      </div>
      <PdfFoot />
    </div>
  );
}

// ---- Page 4 · Days 4–7 ----
function PdfDays2() {
  const { DAYS } = window;
  return (
    <div className="pdf">
      <PdfRun page={4} total={6} />
      <div className="pdf-content">
        {DAYS.slice(3).map((d) => <PdfDay key={d.n} d={d} />)}
      </div>
      <PdfFoot />
    </div>
  );
}

// ---- Page 5 · Inclusions + Investment ----
function PdfPricing() {
  const { INCLUDED, EXCLUDED, PRICING, inr } = window;
  return (
    <div className="pdf">
      <PdfRun page={5} total={6} />
      <div className="pdf-content">
        <PdfSH eyebrow="Investment" title="Your package price" />
        <div className="pdf-invest">
          <div className="glow"></div>
          <div className="inner">
            <div>
              <div className="eyb">Total package</div>
              <div className="tot">{inr(PRICING.total)}</div>
              <div className="pp">{inr(PRICING.perPerson)} per person · {PRICING.travelers} travellers</div>
            </div>
          </div>
        </div>
        <div className="pdf-brk">
          {PRICING.categories.map((c) => (
            <div className="r" key={c.label}><span className="c">{c.label}</span><span className="a">{inr(c.amount)}</span></div>
          ))}
          <div className="tr"><span className="c">Total</span><span className="a">{inr(PRICING.total)}</span></div>
        </div>
        <p className="pdf-valid">
          All amounts are in Indian Rupees and inclusive of applicable service charges.
          This quotation is valid until {PRICING.validUntil}.
        </p>

        <div className="pdf-inc">
          <div>
            <div className="h in">Your package includes</div>
            {INCLUDED.map((it, i) => <div className="it in" key={i}><window.Check /> {it}</div>)}
          </div>
          <div>
            <div className="h ex">Not included</div>
            {EXCLUDED.map((it, i) => <div className="it ex" key={i}><window.X /> {it}</div>)}
          </div>
        </div>
      </div>
      <PdfFoot />
    </div>
  );
}

// ---- Page 6 · Closing ----
function PdfClosing() {
  const { AGENCY } = window;
  return (
    <div className="pdf-close">
      <div className="glow"></div>
      <div className="inner">
        <span className="seal">{AGENCY.monogram}</span>
        <p className="sig">
          "We've poured a little of our own love for Bali into these pages. When
          you're ready, we'll handle every detail — so all that's left for you is
          to arrive."
        </p>
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 9.5, letterSpacing: ".3em", textTransform: "uppercase", color: "var(--sand)" }}>With warm regards</div>
          <div className="ag">{AGENCY.name}</div>
        </div>
        <div className="cts">
          <div><div className="l">Phone</div><div className="v">{AGENCY.phone}</div></div>
          <div><div className="l">Email</div><div className="v">{AGENCY.email}</div></div>
          <div><div className="l">Web</div><div className="v">{AGENCY.website}</div></div>
        </div>
      </div>
      <div className="craft">Crafted with TripCraft</div>
    </div>
  );
}

Object.assign(window, { PdfCover, PdfGlance, PdfDays1, PdfDays2, PdfPricing, PdfClosing });
