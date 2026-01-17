import React from "react";

export default function FlavorCard({ name, remaining, qty, onMinus, onPlus, disabledMinus, disabledPlus }) {
  return (
    <div className="flavor-item">
      <div className="flavor-left">
        <div className="flavor-name">{name}</div>
        <div className="flavor-stock">Quedan: <strong>{remaining ?? 0}</strong></div>
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
