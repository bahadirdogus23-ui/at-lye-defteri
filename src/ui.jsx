import React from "react";
import { BookOpen } from "lucide-react";
export function Field({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
    </label>
  );
}

export function Empty({ text, detail }) {
  return (
    <div className="empty">
      <span>
        <BookOpen size={26} />
      </span>
      <h3>{text}</h3>
      <p>{detail}</p>
    </div>
  );
}
