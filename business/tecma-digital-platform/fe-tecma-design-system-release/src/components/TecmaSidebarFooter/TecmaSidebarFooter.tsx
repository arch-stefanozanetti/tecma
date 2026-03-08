import TecmaFooterLogo from "../../components/TecmaFooterLogo/TecmaFooterLogo";
import React from "react";


interface TecmaSidebarFooterProps {
  isCollapsed?: boolean;
}

const TecmaSidebarFooter: React.FC<TecmaSidebarFooterProps> = ({ isCollapsed = false }) => {
  if (isCollapsed) {
    return null;
  }

  return (
    <div className="sidebar-wrapper-footer">
      <div className="sidebar-footer">
        <span className="sidebar-footer-powered">Powered by</span>
        <TecmaFooterLogo />
      </div>
    </div>
  );
};

export default React.memo(TecmaSidebarFooter);
