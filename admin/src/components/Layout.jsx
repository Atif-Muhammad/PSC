import { Outlet } from "react-router-dom";
import SideBar from "./SideBar";

function Layout({currentRole}) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-primary-light">
      <SideBar currentRole={currentRole} />
      <main className="flex-1 p-4 md:p-6 overflow-auto max-h-screen">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
