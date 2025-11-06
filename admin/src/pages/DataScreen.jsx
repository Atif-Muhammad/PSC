import { useParams } from "react-router-dom";
import Admins from "../components/screens/Admins";
import Members from "../components/screens/Members"
import Bookings from "../components/screens/Bookings";
import Rooms from "../components/screens/Rooms";
import Halls from "../components/screens/Halls";
import Lawns from "../components/screens/Lawn/Lawns";
import PhotoShoots from "../components/screens/photoshoot/PhotoShoots";
import Sports from "../components/screens/sports/Sports";

export default function DataScreen({ currentRole, id }) {
  const { for: forParam } = useParams();
  const screens = {
    admins: currentRole === "SUPER_ADMIN" ? Admins : null,
    members: Members,
    bookings: Bookings,
    rooms: Rooms,
    halls: Halls,
    lawns: Lawns,
    photoshoots: PhotoShoots,
    sports: Sports
  };

  const ScreenComponent = screens[forParam];

  if (!ScreenComponent)
    return <div className="text-gray-500 p-6">Access Denied</div>;

  return <ScreenComponent id={id}/>;
}
