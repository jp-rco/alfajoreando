import React from "react";

export default function FlavorCard({ 
  name, 
  qty, 
  onMinus, 
  onPlus, 
  disabledMinus, 
  disabledPlus, 
  delayClass,
  bodega,
  myStock,
  otherProfile,
  otherStock
}) {
  return (
    <div className={`flavor-item animate-enter ${delayClass || ""}`}>
      <div className="flavor-left">
        <div className="flavor-name">{name}</div>
        <div className="flavor-stock row" style={{ gap: '12px', marginTop: '6px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.7 }}>Bodega</span>
            <strong>{bodega ?? 0}</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', color: 'var(--c5)' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.7 }}>Mi stock</span>
            <strong>{myStock ?? 0}</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.7 }}>{otherProfile || "Otro"}</span>
            <strong>{otherStock ?? 0}</strong>
          </div>
        </div>
      </div>

      <div className="counter" aria-label={`contador-${name}`}>
        <button className="mini" onClick={onMinus} disabled={disabledMinus} aria-label={`menos-${name}`}>
          −
        </button>
        <div className="num">{qty}</div>
        <button className="mini" onClick={onPlus} disabled={disabledPlus} aria-label={`mas-${name}`}>
          +
        </button>
      </div>
    </div>
  );
}
