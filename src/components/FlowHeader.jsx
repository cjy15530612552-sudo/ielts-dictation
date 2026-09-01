import { Link } from "react-router-dom";
import { PiArrowLeft } from "react-icons/pi";

export function FlowHeader({ backTo = "/", backLabel = "返回首页", trailing = null }) {
  return (
    <header className="flow-header">
      <div className="flow-brand-group">
        <Link className="flow-back" to={backTo}>
          <PiArrowLeft aria-hidden="true" />
          <span>{backLabel}</span>
        </Link>
        <div>
          <p className="flow-brand">IELTS Dictation</p>
          <p className="flow-brand-subtitle">逐句精听</p>
        </div>
      </div>
      {trailing}
    </header>
  );
}
