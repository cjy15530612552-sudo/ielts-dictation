import { Link } from "react-router-dom";
import { PiUploadSimple } from "react-icons/pi";

export function ImportButton() {
  return (
    <div className="import-control">
      <Link
        className="import-button"
        to="/practice/new"
        aria-label="上传 IELTS 原文截图"
      >
        <PiUploadSimple aria-hidden="true" />
        <span>导入</span>
      </Link>
    </div>
  );
}
