// Send proposal composer — the upgraded send/share flow.
function SendComposer() {
  const { AGENCY, TRIP, PRICING, inr } = window;
  return (
    <div className="sc">
      <div className="sc-head">
        <div>
          <div className="eyb gold">Send proposal</div>
          <h3>Bali · {TRIP.preparedFor}</h3>
        </div>
        <span className="x"><window.X /></span>
      </div>

      <div className="sc-body">
        {/* left — compose */}
        <div className="sc-left">
          <div>
            <div className="sc-label">Channel</div>
            <div className="chan">
              <div className="chan-opt on"><window.MessageCircle /><span className="nm">WhatsApp</span></div>
              <div className="chan-opt"><window.Mail /><span className="nm">Email</span></div>
              <div className="chan-opt"><window.Link /><span className="nm">Link only</span></div>
            </div>
          </div>

          <div className="sc-fld">
            <label>Recipient</label>
            <div className="inp"><window.Users /> {TRIP.preparedFor} · +91 99300 22481</div>
          </div>

          <div className="sc-fld">
            <label>Message</label>
            <div className="inp area">
              Hi Aarav &amp; Meera — your Bali proposal is ready ✨ Seven days from
              Ubud to Seminyak, with everything we discussed. Tap below to view,
              and tell us what you'd love to tweak.
            </div>
          </div>

          <div className="sc-toggle">
            <div>
              <div className="tt">Attach PDF proposal</div>
              <div className="ts">A4 document · {inr(PRICING.total)} · 6 pages</div>
            </div>
            <span className="sw"></span>
          </div>

          <div className="sc-fld">
            <label>Quote valid for</label>
            <div className="inp"><window.Clock /> 14 days · until {PRICING.validUntil}</div>
          </div>
        </div>

        {/* right — preview */}
        <div className="sc-right">
          <div className="sc-label">WhatsApp preview</div>
          <div className="wa-prev">
            <div className="wa-bubble">
              <div className="msg">
                Hi Aarav &amp; Meera — your Bali proposal is ready ✨ Seven days from
                Ubud to Seminyak, with everything we discussed. Tap below to view.
              </div>
              <div className="wa-card">
                <div className="img">
                  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 80% 20%, rgba(200,169,106,.4), transparent), linear-gradient(180deg, rgba(8,16,24,.2), rgba(8,16,24,.85))" }}></div>
                  <div style={{ position: "absolute", left: 11, bottom: 9, color: "#fff", fontFamily: "var(--serif)", fontSize: 24, lineHeight: 1 }}>Bali</div>
                </div>
                <div className="meta">
                  <div className="tt">Bali — A journey for two · {AGENCY.name}</div>
                  <div className="ds">7 days · {TRIP.dateRange} · from {inr(PRICING.perPerson)} pp</div>
                  <div className="ln">wayfarer.co/p/bali-sharma-v2</div>
                </div>
              </div>
              <div className="wa-time">11:42 ✓✓</div>
            </div>
          </div>
        </div>
      </div>

      <div className="sc-foot">
        <span className="note">Sent from {AGENCY.name} · WhatsApp Business</span>
        <div className="flex ac" style={{ gap: 10 }}>
          <span className="btn btn-ghost btn-sm">Schedule</span>
          <span className="btn-gold-lg"><window.Send /> Send proposal</span>
        </div>
      </div>
    </div>
  );
}
window.SendComposer = SendComposer;
