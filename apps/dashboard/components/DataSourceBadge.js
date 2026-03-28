import { useState } from "react";

const DATA_SOURCES = {
  fiscal: {
    label: "Fiscal View",
    view: "fiscal_contracts",
    includes: "Valid, Transferred Out",
    excludes: "ELAN EXPO (internal), Cancelled, Transferred In, On Hold",
    purpose: "Company sales performance — who sold what, when.",
    tip: "Edition view (Expo Directory, Finance) uses Valid + Transferred In instead.",
  },
  edition: {
    label: "Edition View",
    view: "edition_contracts",
    includes: "Valid, Transferred In",
    excludes: "Cancelled, Transferred Out, On Hold",
    purpose: "Expo participation — which exhibitors are in this expo.",
    tip: "Fiscal view (Sales page) uses Valid + Transferred Out instead.",
  },
};

export default function DataSourceBadge({ mode = "fiscal" }) {
  const [open, setOpen] = useState(false);
  const src = DATA_SOURCES[mode] || DATA_SOURCES.fiscal;

  return (
    <>
      <div className="ds-badge" onClick={() => setOpen(!open)}>
        <span className="ds-badge-icon">i</span>
        <span className="ds-badge-label">{src.label}</span>
        <span className="ds-badge-detail">
          {src.includes}
          {mode === "fiscal" ? " | excl. ELAN EXPO" : ""}
        </span>
        <span className={`ds-badge-chevron${open ? " open" : ""}`}>&#9662;</span>
      </div>
      {open && (
        <div className="ds-detail">
          <div className="ds-detail-row">
            <span className="ds-detail-key">Source</span>
            <span className="ds-detail-val">{src.view}</span>
          </div>
          <div className="ds-detail-row">
            <span className="ds-detail-key">Includes</span>
            <span className="ds-detail-val">{src.includes}</span>
          </div>
          <div className="ds-detail-row">
            <span className="ds-detail-key">Excludes</span>
            <span className="ds-detail-val">{src.excludes}</span>
          </div>
          <div className="ds-detail-row">
            <span className="ds-detail-key">Purpose</span>
            <span className="ds-detail-val">{src.purpose}</span>
          </div>
          <div className="ds-detail-tip">{src.tip}</div>
        </div>
      )}
      <style jsx>{`
        .ds-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 4px;
          background: var(--surface-2, #141B22);
          border: 1px solid var(--border, #1E2A35);
          cursor: pointer;
          font-family: var(--font-mono, "DM Mono", monospace);
          font-size: 11px;
          color: var(--text-secondary, #8A919A);
          user-select: none;
          margin-top: 6px;
          transition: border-color 0.2s;
        }
        .ds-badge:hover {
          border-color: var(--accent-color, #C8A97A);
        }
        .ds-badge-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 1px solid var(--text-secondary, #8A919A);
          font-size: 9px;
          font-style: italic;
          flex-shrink: 0;
        }
        .ds-badge-label {
          color: var(--text-primary, #E0E0E0);
          font-weight: 500;
        }
        .ds-badge-detail {
          color: var(--text-secondary, #8A919A);
        }
        .ds-badge-chevron {
          font-size: 8px;
          transition: transform 0.2s;
        }
        .ds-badge-chevron.open {
          transform: rotate(180deg);
        }
        .ds-detail {
          margin-top: 6px;
          padding: 10px 12px;
          border-radius: 4px;
          background: var(--surface-2, #141B22);
          border: 1px solid var(--border, #1E2A35);
          font-family: var(--font-mono, "DM Mono", monospace);
          font-size: 11px;
          max-width: 420px;
        }
        .ds-detail-row {
          display: flex;
          gap: 8px;
          margin-bottom: 4px;
        }
        .ds-detail-key {
          color: var(--text-secondary, #8A919A);
          min-width: 70px;
          flex-shrink: 0;
        }
        .ds-detail-val {
          color: var(--text-primary, #E0E0E0);
        }
        .ds-detail-tip {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--border, #1E2A35);
          color: var(--accent-color, #C8A97A);
          font-size: 10px;
        }
        @media (max-width: 480px) {
          .ds-badge-detail { display: none; }
          .ds-detail { max-width: 100%; }
        }
      `}</style>
    </>
  );
}
