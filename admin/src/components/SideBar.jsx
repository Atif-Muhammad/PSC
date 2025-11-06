import { Book, Camera, Home, LandmarkIcon, LayoutDashboard, Lock, ShieldUser, TreePalm, Users2Icon, LucideGamepad } from "lucide-react";
import { NavLink } from "react-router-dom";
import psc from "../assets/psc_logo_gold.png"

function SideBar({ currentRole }) {
  const isSuperAdmin = currentRole === "SUPER_ADMIN";

  const links = [
    { title: "DASHBOARD", icon: <LayoutDashboard/> , url: "/", locked: false },
    { title: "ADMINS", icon: <ShieldUser/> , url: "/data/admins", locked: !isSuperAdmin },
    { title: "MEMBERS", icon: <Users2Icon/> , url: "/data/members", locked: false },
    { title: "Bookings", icon: <Book/> , url: "/data/bookings", locked: false },
    { title: "Rooms", icon: <Home/> , url: "/data/rooms", locked: !isSuperAdmin },
    { title: "Halls", icon: <LandmarkIcon/>, url: "/data/halls", locked: !isSuperAdmin },
    { title: "Lawns", icon: <TreePalm/>, url: "/data/lawns", locked: !isSuperAdmin },
    { title: "PhotoShoots", icon: <Camera/>, url: "/data/photoshoots", locked: !isSuperAdmin },
    { title: "Sports Activities", icon: <LucideGamepad/>, url: "/data/sports", locked: !isSuperAdmin },
  ];

  return (
    <aside className="flex flex-col min-h-screen items-center bg-primary-dark">
      {/* Header */}
      <div className="border-b border-primary-light h-1/6 grid place-items-center">
        <img src={psc} alt="logo" className="h-5/8" />
      </div>

      {/* Nav Links */}
      <nav className="flex-1 flex flex-col py-4 space-y-1 overflow-auto w-full items-center">
        {links.map((link, idx) => {
          const isDisabled = link.locked;

          return (
            <NavLink
              key={idx}
              to={isDisabled ? "#" : link.url}
              className={({ isActive }) =>
                `w-full py-2 sm:py-3 text-xs gap-y-1 transition-all duration-200 flex flex-col items-center justify-center ${isActive? "text-white": "text-white/70"}
                ${
                  isActive && !isDisabled
                    ? "bg-primary-light"
                    : isDisabled
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-primary-light/30"
                }`
              }
              onClick={(e) => {
                if (isDisabled) e.preventDefault();
              }}
              end
            >
              {link.icon}
              <span>{link.title}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto px-7 py-4 border-t border-gray-700 text-xs text-gray-400">
        © {new Date().getFullYear()} PSC-Admin
      </div>
    </aside>
  );
}

export default SideBar;
