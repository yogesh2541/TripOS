// Customer-facing web proposal — editorial, long-form. Consumes window trip data.
function ProposalWeb() {
  const { AGENCY, TRIP, DAYS, GLANCE, INCLUDED, EXCLUDED, PRICING, inr } = window;

  return (
    <div className="pp">
      {/* ============ COVER ============ */}
      <header className="pp-cover">
        <image-slot id="pp-cover-bali" shape="rect"
          placeholder="Bali cover — Kelingking cliffs / rice terrace at golden hour"></image-slot>
        <div className="scrim"></div>
        <div className="glow"></div>
        <div className="pp-cover-inner">
          <div className="cover-top">
            <div className="cover-brand">
              <span className="seal" style={{ width: 44, height: 44, fontSize: 16, background: "rgba(255,255,255,.05)" }}>{AGENCY.monogram}</span>
              <div>
                <div className="cover-word">WAYFARER &amp; CO.</div>
                <div className="cover-tag">{AGENCY.tagline}</div>
              </div>
            </div>
            <div className="cover-vrow">
              <div className="l">Travel Proposal</div>
              <div className="v">v{TRIP.version} · {TRIP.dateRange}</div>
            </div>
          </div>

          <div className="cover-headline">
            <div className="cover-kicker">A journey for {TRIP.travelers}</div>
            <div className="cover-title">{TRIP.destination}</div>
            <div className="cover-sub">{TRIP.subtitle}</div>
            <div className="cover-prepared">Prepared for <b>{TRIP.preparedFor}</b></div>

            <div className="cover-meta">
              <div className="cmeta">
                <div className="l"><window.Calendar /> Duration</div>
                <div className="v">{TRIP.days}<small> days</small> / {TRIP.nights}<small> nights</small></div>
              </div>
              <div className="cmeta">
                <div className="l"><window.MapPin /> Travel dates</div>
                <div className="v">{TRIP.dateRange}</div>
              </div>
              <div className="cmeta">
                <div className="l"><window.Users /> Travellers</div>
                <div className="v">{TRIP.travelers}<small> guests</small></div>
              </div>
              <div className="cmeta">
                <div className="l"><window.Compass /> Style</div>
                <div className="v">{TRIP.style}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ============ OVERVIEW / AT A GLANCE ============ */}
      <section className="pp-sec">
        <div className="sec-kicker">
          <span className="eyb gold">The Overview</span>
          <span className="ln"></span>
          <span className="seal on-light" style={{ width: 30, height: 30, fontSize: 12 }}>{AGENCY.monogram}</span>
        </div>
        <div className="ov-grid">
          <div>
            <p className="ov-lead">{TRIP.summary}</p>
            <p className="ov-note">
              This itinerary is fully bespoke and can be tuned to your pace —
              add a day, soften the early starts, or upgrade a suite. Pricing on
              the final pages holds for {TRIP.validityDays} days from issue.
            </p>
          </div>
          <div>
            <div className="eyb" style={{ marginBottom: 16 }}>The Itinerary</div>
            <div className="ov-index">
              {GLANCE.map((g) => (
                <div className="ov-row" key={g.n}>
                  <span className="num">{String(g.n).padStart(2, "0")}</span>
                  <span className="place">{g.where}</span>
                  <span className="dots"></span>
                  <span className="stay">{g.stay}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ DAY BY DAY ============ */}
      <section className="pp-sec" style={{ background: "var(--paper)" }}>
        <div className="sec-kicker">
          <span className="eyb gold">The Journey</span>
          <span className="ln"></span>
        </div>
        <h2 className="sec-h" style={{ marginBottom: 8 }}>Day by day</h2>
        <div style={{ marginTop: 28 }}>
          {DAYS.map((d) => <DayBlock key={d.n} d={d} />)}
        </div>
      </section>

      {/* ============ INCLUSIONS ============ */}
      <section className="pp-sec">
        <div className="sec-kicker">
          <span className="eyb gold">The Fine Print</span>
          <span className="ln"></span>
        </div>
        <h2 className="sec-h" style={{ marginBottom: 36 }}>What's included</h2>
        <div className="inc-grid">
          <div>
            <div className="inc-h in">Your package includes</div>
            {INCLUDED.map((it, i) => (
              <div className="inc-item in" key={i}><window.Check /> {it}</div>
            ))}
          </div>
          <div>
            <div className="inc-h ex">Not included</div>
            {EXCLUDED.map((it, i) => (
              <div className="inc-item ex" key={i}><window.X /> {it}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ INVESTMENT ============ */}
      <section className="pp-sec pp-invest">
        <div className="glow"></div>
        <div className="invest-grid">
          <div>
            <div className="invest-eyb">The Investment</div>
            <div className="invest-total">{inr(PRICING.total)}</div>
            <div className="invest-pp">{inr(PRICING.perPerson)} per person · {PRICING.travelers} travellers</div>
            <p className="invest-valid">
              All amounts in Indian Rupees, inclusive of applicable service
              charges. This quotation is valid until {PRICING.validUntil}.
            </p>
          </div>
          <div className="invest-break">
            <div className="brk-h">How it breaks down</div>
            {PRICING.categories.map((c) => (
              <div className="brk-row" key={c.label}>
                <span className="c">{c.label}</span>
                <span className="a">{inr(c.amount)}</span>
              </div>
            ))}
            <div className="brk-total">
              <span className="c">Total package</span>
              <span className="a">{inr(PRICING.total)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ TERMS ============ */}
      <section className="pp-sec tight">
        <div className="sec-kicker">
          <span className="eyb">Booking Terms</span>
          <span className="ln"></span>
        </div>
        <div className="terms-box">
          <p className="terms-body">
            A 30% deposit confirms your booking; the balance is due 21 days before
            departure. Cancellations made more than 30 days prior are refunded less
            the deposit; within 30 days, supplier cancellation terms apply. Rates
            are based on current exchange rates and may revise if taxes or fuel
            surcharges change before ticketing. Hotel check-in is 2 PM and
            check-out 12 PM unless arranged otherwise. Wayfarer &amp; Co. acts as a
            booking agent for the listed suppliers; their terms govern the services
            provided. Travel insurance is strongly recommended and can be arranged
            on request.
          </p>
        </div>
      </section>

      {/* ============ CLOSING ============ */}
      <footer className="pp-close">
        <span className="seal">{AGENCY.monogram}</span>
        <p className="close-sig">
          "We've poured a little of our own love for Bali into these pages. When
          you're ready, we'll handle every detail — so all that's left for you is
          to arrive."
        </p>
        <div style={{ marginTop: 26 }}>
          <div className="close-eyb">With warm regards</div>
          <div className="close-agency">{AGENCY.name}</div>
        </div>
        <div className="close-contacts">
          <div><div className="l">Phone</div><div className="v">{AGENCY.phone}</div></div>
          <div><div className="l">Email</div><div className="v">{AGENCY.email}</div></div>
          <div><div className="l">Web</div><div className="v">{AGENCY.website}</div></div>
        </div>
        <div className="close-craft">Crafted with TripCraft</div>
      </footer>
    </div>
  );
}

function DayBlock({ d }) {
  return (
    <article className="day">
      <div className="day-rail">
        <div className="day-num">{String(d.n).padStart(2, "0")}</div>
        <div className="day-date">{d.date}</div>
        <div className="day-pin"><window.MapPin /> {d.city}</div>
        {d.meals && d.meals.length > 0 && (
          <div className="day-meals">
            {d.meals.map((m) => <span className="mchip" key={m}>{m}</span>)}
          </div>
        )}
      </div>
      <div className="day-body">
        <h3 className="day-title">{d.title}</h3>
        <p className="day-text">{d.text}</p>
        {d.img && (
          <>
            <div className="day-img">
              <div className="img-ph"><window.Eye /><span>Photo · {d.city}</span></div>
              <image-slot id={`pp-${d.img}`} shape="rect" style={{ position: "relative", zIndex: 1 }}
                placeholder={`Day ${d.n} — ${d.city}`}></image-slot>
            </div>
            <div className="day-cap">{d.city}</div>
          </>
        )}
        <div className="exp">
          <div className="exp-h">Experiences &amp; highlights</div>
          <div className="exp-list">
            {d.exp.map((e, i) => (
              <div className="exp-item" key={i}><span className="bull"></span>{e}</div>
            ))}
          </div>
        </div>
        {d.stay && (
          <div className="stay-card">
            <span className="ic"><window.Building /></span>
            <div>
              <div className="l">Where you'll stay</div>
              <div className="v">{d.stay} <small>· {d.room}</small></div>
            </div>
          </div>
        )}
        {d.quote && <blockquote className="pullquote">{d.quote}</blockquote>}
      </div>
    </article>
  );
}

window.ProposalWeb = ProposalWeb;
